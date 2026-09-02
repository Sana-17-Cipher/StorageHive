from fastapi import FastAPI
from datetime import datetime

app = FastAPI(title="Mini Hadoop NameNode")

registered_nodes = {}

#NameNode has an actual API.

@app.post("/register")
def register_node(node_id: str):
    registered_nodes[node_id] = {
        "node_id": node_id,
        "registered_at": datetime.now().isoformat()
    }

    print(f"DataNode registered: {node_id}")

    return {
        "message": "DataNode registered successfully",
        "node_id": node_id
    }


@app.get("/nodes")
def get_nodes():
    return {
        "count": len(registered_nodes),
        "nodes": list(registered_nodes.values())
    }