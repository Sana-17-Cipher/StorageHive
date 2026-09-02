from fastapi import FastAPI
from datetime import datetime, timedelta
import threading
import time

app = FastAPI(title="Mini Hadoop NameNode")

registered_nodes = {}
HEARTBEAT_TIMEOUT = 10


@app.post("/register")
def register_node(node_id: str):
    now = datetime.now()

    registered_nodes[node_id] = {
        "node_id": node_id,
        "registered_at": now.isoformat(),
        "last_heartbeat": now.isoformat(),
        "status": "ALIVE"
    }

    print(f"DataNode registered: {node_id}")

    return {
        "message": "DataNode registered successfully",
        "node_id": node_id
    }


@app.post("/heartbeat")
def heartbeat(node_id: str):
    if node_id not in registered_nodes:
        return {
            "message": "DataNode not registered",
            "status": "UNKNOWN"
        }

    registered_nodes[node_id]["last_heartbeat"] = datetime.now().isoformat()
    registered_nodes[node_id]["status"] = "ALIVE"

    print(f"Heartbeat received from: {node_id}")

    return {
        "message": "Heartbeat received",
        "node_id": node_id
    }


@app.get("/nodes")
def get_nodes():
    return {
        "count": len(registered_nodes),
        "nodes": list(registered_nodes.values())
    }


def monitor_nodes():
    while True:
        now = datetime.now()

        for node_id, node in registered_nodes.items():
            last_heartbeat = datetime.fromisoformat(
                node["last_heartbeat"]
            )

            if (
                now - last_heartbeat > timedelta(seconds=HEARTBEAT_TIMEOUT)
                and node["status"] == "ALIVE"
            ):
                node["status"] = "DEAD"
                print(f"DataNode failure detected: {node_id}")

        time.sleep(2)


monitor_thread = threading.Thread(
    target=monitor_nodes,
    daemon=True
)

monitor_thread.start()