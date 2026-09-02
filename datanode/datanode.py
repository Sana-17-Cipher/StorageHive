import os
import time
import urllib.request

node_id = os.getenv("NODE_ID", "unknown")
namenode_url = "http://namenode:8000"


def send_request(endpoint):
    url = f"{namenode_url}{endpoint}?node_id={node_id}"

    request = urllib.request.Request(
        url,
        method="POST"
    )

    with urllib.request.urlopen(request) as response:
        return response.read().decode()


print(f"{node_id} started")

# Register with NameNode
while True:
    try:
        response = send_request("/register")
        print(f"{node_id} registered with NameNode")
        print(response)
        break
    except Exception:
        print(f"{node_id}: NameNode not ready, retrying...")
        time.sleep(3)


# Send heartbeat every 5 seconds
while True:
    try:
        response = send_request("/heartbeat")
        print(f"{node_id} heartbeat sent")
    except Exception as error:
        print(f"{node_id}: heartbeat failed - {error}")

    time.sleep(5)