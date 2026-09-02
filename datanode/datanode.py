import os
import time
import urllib.request


node_id = os.getenv("NODE_ID", "unknown")
namenode_url = "http://namenode:8000/register" # Docker's network allows containers to find each other using their service names.

# Make DataNodes register themselves

def register():
    url = f"{namenode_url}?node_id={node_id}"

    request = urllib.request.Request(
        url,
        method="POST"
    )

    with urllib.request.urlopen(request) as response:
        print(response.read().decode())


print(f"{node_id} started")

while True:
    try:
        register()
        print(f"{node_id} registered with NameNode")
        break
    except Exception:
        print(f"{node_id}: NameNode not ready, retrying...")
        time.sleep(3)

while True:
    time.sleep(10)