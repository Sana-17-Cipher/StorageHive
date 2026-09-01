import os
import time

node_id = os.getenv("NODE_ID", "unknown")

print(f"{node_id} started")
print(f"{node_id} is ready")

while True:
    time.sleep(10)
    
#The NODE_ID is why we can use one DataNode Docker image for all three nodes.