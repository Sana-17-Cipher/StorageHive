import { createServer, request as httpRequest } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { currentUser, handleAuth } from './auth.mjs'


const nameNodeUrl = process.env.NAMENODE_URL ?? 'http://namenode:9870'

const maxUploadBytes = 10 * 1024 * 1024

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function webHdfsUrl(path, operation, options = {}) {
  const url = new URL(`/webhdfs/v1${path}`, nameNodeUrl)
  url.search = new URLSearchParams({
    op: operation,
    'user.name': 'root',
    ...options,
  }).toString()
  return url
}

function callHadoop(url, options = {}) {
  return fetch(url, {
    signal: AbortSignal.timeout(30_000),
    ...options,
  })
}

const routes = {
  '/api/cluster': async () => {
    const url = new URL('/jmx', nameNodeUrl)
    url.searchParams.set('qry', 'Hadoop:service=NameNode,name=FSNamesystemState')

    const response = await callHadoop(url, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`NameNode metrics returned HTTP ${response.status}`)
    }

    const { beans } = await response.json()
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
  '/api/files': async (directory) => {
    const response = await callHadoop(webHdfsUrl(directory, 'LISTSTATUS'))

    if (response.status === 404) {
      const error = await response.json().catch(() => null)

      if (error?.RemoteException?.exception === 'FileNotFoundException') {
        return []
      }
    }

    if (!response.ok) {
      throw new Error(`WebHDFS LISTSTATUS returned HTTP ${response.status}`)
    }

    const data = await response.json()

    return data.FileStatuses.FileStatus.map((entry) => ({
      name: entry.pathSuffix,
      type: entry.type,
      sizeBytes: entry.length,
      replication: entry.replication,
    }))
  },
}

async function sendHadoopError(response, upstream) {
  const body = await upstream.json().catch(() => null)
  const exception = body?.RemoteException?.exception

  if (exception === 'FileAlreadyExistsException') {
    return sendJson(response, 409, { error: 'A file with this name already exists' })
  }

  if (upstream.status === 404 || exception === 'FileNotFoundException') {
    return sendJson(response, 404, { error: 'File not found' })
  }

  throw new Error(`WebHDFS returned HTTP ${upstream.status}`)
}

function uploadToDataNode(url, body) {
  return new Promise((resolve, reject) => {
    const upload = httpRequest(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': body.length,
      },
      signal: AbortSignal.timeout(30_000),
    }, (reply) => {
      const status = reply.statusCode
      const chunks = []

      reply.on('data', (chunk) => chunks.push(chunk))
      reply.on('error', reject)
      reply.on('end', () => {
        resolve({
          status,
          ok: status >= 200 && status < 300,
          json: async () => JSON.parse(Buffer.concat(chunks).toString('utf8')),
        })
      })
    })

    upload.on('error', reject)
    upload.end(body)
  })
}
async function handleFile(request, response, filename, directory) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,127}$/.test(filename)) {
    return sendJson(response, 400, {
      error: 'Use a filename that starts with a letter or number and contains only letters, numbers, spaces, dots, underscores, or hyphens',
    })
  }

    const path = `${directory}/${encodeURIComponent(filename)}`
  if (request.method === 'PUT') {
    const chunks = []
    let size = 0

    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length

      if (size > maxUploadBytes) {
        response.setHeader('Connection', 'close')
        return sendJson(response, 413, { error: 'Maximum upload size is 10 MiB' })
      }

      chunks.push(chunk)
    }

        const folder = await callHadoop(webHdfsUrl(directory, 'MKDIRS'), {
      method: 'PUT',
    })

    if (!folder.ok) return sendHadoopError(response, folder)

    if (!(await folder.json()).boolean) {
      throw new Error('Could not create the HDFS account directory')
    }

    const destination = await callHadoop(
      webHdfsUrl(path, 'CREATE', { overwrite: 'false' }),
      { method: 'PUT', redirect: 'manual' }
    )

    if (destination.status !== 307) {
      return sendHadoopError(response, destination)
    }

    const location = destination.headers.get('location')

    if (!location) {
      throw new Error('NameNode did not return a DataNode address')
    }

    const uploaded = await uploadToDataNode(
      new URL(location, nameNodeUrl),
      Buffer.concat(chunks, size)
    )

    if (!uploaded.ok) return sendHadoopError(response, uploaded)

    return sendJson(response, 201, { name: filename, sizeBytes: size })
  }

  if (request.method === 'GET') {
    const file = await callHadoop(webHdfsUrl(path, 'OPEN'))

    if (!file.ok) return sendHadoopError(response, file)

    response.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })

    return pipeline(Readable.fromWeb(file.body), response)
  }

  if (request.method === 'DELETE') {
    const deleted = await callHadoop(
      webHdfsUrl(path, 'DELETE', { recursive: 'false' }),
      { method: 'DELETE' }
    )

    if (!deleted.ok) return sendHadoopError(response, deleted)

    if (!(await deleted.json()).boolean) {
      return sendJson(response, 404, { error: 'File not found' })
    }

    return sendJson(response, 200, { deleted: filename })
  }

  response.setHeader('Allow', 'GET, PUT, DELETE')
  return sendJson(response, 405, { error: 'Method not supported' })
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost')
  const filePrefix = '/api/files/'
      if (pathname.startsWith('/api/auth/')) {
      return await handleAuth(request, response, pathname, sendJson)
    }

    let directory
    if (pathname === '/api/files' || pathname.startsWith(filePrefix)) {
      response.setHeader('Cache-Control', 'no-store')
      const user = await currentUser(request)
      if (!user) {
        return sendJson(response, 401, { error: 'Sign in first' })
      }
      directory = `/accounts/${user.storage_key}`
    }

  try {

    if (pathname.startsWith(filePrefix)) {
      let filename

      try {
        filename = decodeURIComponent(pathname.slice(filePrefix.length))
      } catch {
        return sendJson(response, 400, { error: 'Invalid filename encoding' })
      }

      return await handleFile(request, response, filename, directory)
    }

    if (!Object.hasOwn(routes, pathname)) {
      return sendJson(response, 404, { error: 'Route not found' })
    }

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      return sendJson(response, 405, { error: 'Only GET is supported' })
    }

    const body = await routes[pathname](directory)
    sendJson(response, 200, body)
  } catch (error) {
    console.error(error)

    if (response.destroyed || response.headersSent) {
      response.destroy()
      return
    }

    sendJson(response, 502, { error: 'Could not complete the Hadoop request' })
  }
}).listen(3001, '0.0.0.0', () => {
  console.log('StorageHive API listening on port 3001')
})