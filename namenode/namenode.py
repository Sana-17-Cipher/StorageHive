from fastapi import FastAPI
from datetime import datetime

app = FastAPI(title="Mini Hadoop NameNode")

registered_nodes = {}


@app.post("/register")
def register_node(node_id: str):
    registered_nodes[node_id] = {
        "node_id": node_id,
        "registered_at": datetime.now().isoformat(),
        "last_heartbeat": datetime.now().isoformat(),
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