import { createServer } from 'node:http'

const nameNodeUrl = process.env.NAMENODE_URL ?? 'http://namenode:9870'

async function readHadoopJson(path) {
  const response = await fetch(new URL(path, nameNodeUrl), {
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    throw new Error(`NameNode returned HTTP ${response.status}`)
  }

  return response.json()
}

const routes = {
  '/api/cluster': async () => {
    const query = new URLSearchParams({
      qry: 'Hadoop:service=NameNode,name=FSNamesystemState',
    })
    const { beans } = await readHadoopJson(`/jmx?${query}`)
    const metrics = beans?.[0]

    if (
      typeof metrics?.NumLiveDataNodes !== 'number' ||
      typeof metrics?.NumDeadDataNodes !== 'number'
    ) {
      throw new Error('NameNode metrics are unavailable')
    }

    return {
      liveDataNodes: metrics.NumLiveDataNodes,
      deadDataNodes: metrics.NumDeadDataNodes,
    }
  },

  '/api/files': async () => {
    const data = await readHadoopJson(
      '/webhdfs/v1/demo?op=LISTSTATUS&user.name=root'
    )

    return data.FileStatuses.FileStatus.map((entry) => ({
      name: entry.pathSuffix,
      type: entry.type,
      sizeBytes: entry.length,
      replication: entry.replication,
    }))
  },
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost')

  if (!Object.hasOwn(routes, pathname)) {
    return sendJson(response, 404, { error: 'Route not found' })
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return sendJson(response, 405, { error: 'Only GET is supported' })
  }

  try {
    const body = await routes[pathname]()
    sendJson(response, 200, body)
  } catch (error) {
    console.error(error)
    sendJson(response, 502, { error: 'Could not read data from Hadoop' })
  }
}).listen(3001, '0.0.0.0', () => {
  console.log('StorageHive API listening on port 3001')
})