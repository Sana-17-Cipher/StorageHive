import { useEffect, useState } from 'react'

async function api(path, options) {
  const response = await fetch(path, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  return data
}

function fileUrl(name) {
  return `/api/files/${encodeURIComponent(name)}`
}

export default function App() {
  const [cluster, setCluster] = useState(null)
  const [files, setFiles] = useState([])
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [status, entries] = await Promise.all([
      api('/api/cluster'),
      api('/api/files'),
    ])
    setCluster(status)
    setFiles(entries.filter((entry) => entry.type === 'FILE'))
  }

  useEffect(() => {
    refresh().catch((error) => setError(error.message))
  }, [])

  useEffect(() => {
  let active = true
  let timer

  async function pollCluster() {
    try {
      const status = await api('/api/cluster', {
        signal: AbortSignal.timeout(4000),
      })
      if (active) setCluster(status)
    } catch {
      if (active) setCluster(null)
    } finally {
      if (active) timer = setTimeout(pollCluster, 5000)
    }
  }

  timer = setTimeout(pollCluster, 5000)

  return () => {
    active = false
    clearTimeout(timer)
  }
}, [])

  async function run(action, successMessage = '') {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  function upload(event) {
    event.preventDefault()
    if (!file) return
    const form = event.currentTarget

    run(async () => {
      await api(fileUrl(file.name), { method: 'PUT', body: file })
      form.reset()
      setFile(null)
      await refresh()
    }, `Uploaded ${file.name}`)
  }

  function remove(name) {
    if (!window.confirm(`Delete "${name}" from HDFS?`)) return
    run(async () => {
      await api(fileUrl(name), { method: 'DELETE' })
      await refresh()
    }, `Deleted ${name}`)
  }

  return (
    <main>
      <header>
        <h1>StorageHive</h1>
        <button onClick={() => run(refresh)} disabled={busy}>Refresh</button>
      </header>

      <section className="metrics" aria-label="Cluster status">
        <div><strong>{cluster?.liveDataNodes ?? '…'}</strong> Live DataNodes</div>
        <div><strong>{cluster?.deadDataNodes ?? '…'}</strong> Dead DataNodes</div>
      </section>

      <section className="panel">
        <h2>Files</h2>
        <form onSubmit={upload}>
          <label>
            Choose a file
            <input
              type="file"
              onChange={(event) => setFile(event.target.files[0] ?? null)}
              disabled={busy}
            />
          </label>
          <button disabled={busy || !file}>Upload</button>
        </form>

        {error && <p role="alert" className="error">{error}</p>}
        {message && <p role="status">{message}</p>}

        {files.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Bytes</th><th>Replicas</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {files.map((entry) => (
                  <tr key={entry.name}>
                    <td>{entry.name}</td>
                    <td>{entry.sizeBytes}</td>
                    <td>{entry.replication}</td>
                    <td>
                      <a href={fileUrl(entry.name)} download>Download</a>
                      <button onClick={() => remove(entry.name)} disabled={busy}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          cluster && <p>No files in /demo.</p>
        )}
      </section>
    </main>
  )
}