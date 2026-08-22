# StorageHive

## Distributed Cloud File Storage & Management System

StorageHive is a **Hadoop-based distributed cloud file storage and management system** that uses **Apache Hadoop HDFS** for distributed storage, file replication, and fault tolerance.

The system provides users with a familiar cloud-storage experience where they can upload, organize, search, share, preview, download, and manage their files through a web application. Behind the user interface, files are stored through a distributed HDFS cluster consisting of a NameNode and multiple DataNodes.

StorageHive also provides an **Administrative Dashboard** that makes the underlying distributed system visible. Administrators can monitor cluster health, DataNode availability, storage utilization, replication information, and system activity.

The project combines **full-stack application development, distributed systems, Hadoop HDFS, database management, containerization, and system monitoring** into a single practical system.

---

## 1. Project Overview

Traditional file-management applications can store files inside a local directory or on a single server.

While this approach is simple, a single storage location introduces limitations:

- Storage capacity is limited to one machine.
- Failure of the storage machine can affect data availability.
- Scaling storage requires upgrading or replacing the existing machine.
- Replication and fault tolerance are difficult to demonstrate.
- The distributed storage infrastructure is not visible to users or administrators.

StorageHive approaches the problem using a **distributed storage architecture**.

Instead of treating a single server's filesystem as the primary storage layer, StorageHive uses **Hadoop HDFS**.

A user's file is handled by the application and then stored in HDFS. HDFS manages the physical distribution of the file across its storage nodes and maintains replicas according to the configured replication factor.

This allows StorageHive to demonstrate how a real file-management product can be built on top of a distributed filesystem.

---
## Purpose

StorageHive is built to explore how a cloud-style file storage system can be designed using **distributed storage instead of relying on a single server**.

The project combines a practical file-management application with a multi-node Hadoop HDFS cluster to demonstrate concepts such as **distributed storage, block replication, fault tolerance, scalability, and cluster monitoring**.

The goal is to understand how the user-facing application and the underlying distributed infrastructure work together as a complete system.

---

## How It Works

```text
                    StorageHive
                         │
              ┌──────────┴──────────┐
              │                     │
         User Application       Admin Dashboard
              │                     │
              └──────────┬──────────┘
                         │
                    Backend API
                    /          \
                   /            \
            PostgreSQL          HDFS
             Metadata            │
                         ┌───────┼───────┐
                         ▼       ▼       ▼
                       DN-1    DN-2    DN-3
## 2. What Does the User See?

From a user's perspective, StorageHive works like a cloud file-storage application.

Users can:

- Create an account and log in
- Upload files
- Download files
- Create folders
- Organize files
- Rename and move files
- Search for files
- Preview supported files
- Share files
- Delete and restore files
- View storage usage
- Access their files from multiple devices

The user does not need to know which DataNode contains a particular block.

The application provides a simple interface while the distributed storage layer handles the complexity behind the scenes.

```text
                    USER
                     │
                     ▼
             StorageHive Web App
                     │
                     ▼
                Backend API
                     │
                     ▼
             Distributed Storage
                     │
             ┌───────┼───────┐
             ▼       ▼       ▼
           DN-1     DN-2     DN-3
```

---

## 3. What Happens Behind the Scenes?

When a user uploads a file, the application does not simply place the file inside a local `uploads` folder.

Instead, the request passes through several layers.

```text
User
 │
 ▼
React Web Application
 │
 ▼
Backend API
 │
 ├──────────────► PostgreSQL
 │                  │
 │                  └── User & File Metadata
 │
 ▼
HDFS Storage Layer
 │
 ▼
NameNode
 │
 ▼
HDFS Blocks
 │
 ├──────────────► DataNode 1
 ├──────────────► DataNode 2
 └──────────────► DataNode 3
        │
        ▼
   Replicated Data
```

This separation is an important part of the system design.

The application manages **users, permissions, file metadata, folders, and business logic**, while HDFS manages the **distributed physical storage of file data**.

---

## 4. System Architecture

StorageHive follows a layered client-server architecture.

```text
┌─────────────────────────────────────────────┐
│              Client Layer                   │
│                                             │
│        React Web Application                │
│        Phones / Laptops / Browsers          │
└──────────────────────┬──────────────────────┘
                       │
                       │ HTTP / REST
                       ▼
┌─────────────────────────────────────────────┐
│              Application Layer              │
│                                             │
│          Node.js + Express API              │
│                                             │
│ Authentication │ File Management │ Sharing  │
│ Validation     │ Business Logic  │ Access   │
└───────────────┬─────────────────┬───────────┘
                │                 │
                │                 │ WebHDFS
                ▼                 ▼
┌──────────────────────┐   ┌───────────────────┐
│    Metadata Layer    │   │  Storage Layer    │
│                      │   │                   │
│     PostgreSQL       │   │    Hadoop HDFS    │
│                      │   │                   │
│ Users                │   │     NameNode      │
│ File Metadata        │   │         │         │
│ Folders              │   │   ┌─────┼─────┐   │
│ Sharing              │   │   ▼     ▼     ▼   │
│ Activity             │   │ DN-1  DN-2  DN-3  │
└──────────────────────┘   └───────────────────┘
```

### Architectural Separation

StorageHive separates the major responsibilities of the system:

**Client Layer**  
Handles the user interface and user interaction.

**Application Layer**  
Handles authentication, authorization, validation, file operations, business logic, and APIs.

**Metadata Layer**  
Stores information about users, files, folders, permissions, and application activity.

**Distributed Storage Layer**  
Uses HDFS to store the actual file data across multiple DataNodes.

**Administration Layer**  
Provides visibility into the health and behavior of the distributed storage infrastructure.

This separation makes the architecture easier to understand, maintain, test, and scale.

---

## 5. Why Use HDFS?

HDFS is designed for storing large amounts of data across multiple machines.

StorageHive uses HDFS to demonstrate the fundamental concepts of distributed storage.

### HDFS provides:

- Block-based file storage
- Distribution of data across DataNodes
- Replication of blocks
- Failure handling
- Distributed storage capacity
- Centralized filesystem metadata through the NameNode

The objective is not simply to use Hadoop as a storage library. The objective is to understand how a distributed filesystem becomes part of a larger application architecture.

---

## 6. HDFS Architecture

StorageHive uses the main components of HDFS.

### NameNode

The NameNode manages the HDFS filesystem namespace and maintains metadata about:

- Files
- Directories
- File-to-block relationships
- Block locations
- DataNode information

### DataNodes

DataNodes are the storage workers of HDFS.

They are responsible for storing the actual blocks of file data.

StorageHive uses multiple DataNodes to simulate a distributed storage environment.

```text
                NameNode
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
   DataNode 1  DataNode 2  DataNode 3
```

---

## 7. HDFS Blocks & Replication

When a file is stored in HDFS, it is handled as a collection of blocks.

For example, with a replication factor of 3:

```text
Block 1 ──► DataNode 1
         ├─► DataNode 2
         └─► DataNode 3
```

This means the same logical block can exist on multiple storage nodes. The exact placement of blocks and replicas is managed by HDFS.

StorageHive will expose this behavior through the administrative monitoring layer so that the distributed nature of storage can be observed rather than hidden.

---

## 8. Fault Tolerance

**Fault tolerance is a core requirement of StorageHive.**

A distributed storage system should continue providing access to replicated data even when an individual storage node becomes unavailable.

StorageHive will demonstrate this using the Docker-based HDFS cluster.


This provides a practical demonstration of:

- Node failure
- Replicated data
- Data availability
- HDFS recovery behavior
- Distributed-system resilience

---

## 9. Metadata vs File Data

A major system-design decision in StorageHive is separating **metadata** from **file data**.

### PostgreSQL stores metadata

Examples include:

```text
User
 ├── ID
 ├── Name
 └── Email

File
 ├── ID
 ├── Name
 ├── Owner
 ├── Size
 ├── MIME Type
 ├── HDFS Path
 └── Created At
```

### HDFS stores actual file data

```text
File
   │
   ▼
HDFS
   │
   ├── Block 1
   ├── Block 2
   └── Block 3
```

PostgreSQL therefore does not need to store the actual contents of large files.

It stores information **about the files**, while HDFS handles the actual distributed file storage.

---

## 10. Admin Dashboard

StorageHive includes a separate administrative interface because understanding a distributed system requires visibility into its internal state.

The dashboard will provide information such as:

### Cluster

- Overall cluster health
- NameNode status
- DataNode count
- Active nodes
- Unavailable nodes

### Storage

- Total HDFS capacity
- Used capacity
- Available capacity
- Storage utilization
- Number of stored files

### Replication

- Replication factor
- Block information
- Replica status
- Replication health

### Application

- Number of users
- Number of files
- Storage consumed
- Upload activity
- Download activity

The dashboard acts as an **observability layer** over the distributed system.

---

## 11. Multi-Device Access

StorageHive is designed as a centralized service that can be accessed from multiple clients.

```text
       Phone 1 ──┐
       Phone 2 ──┤
       Laptop ───┼──► StorageHive API
       Desktop ──┘          │
                            ▼
                       HDFS Cluster
```

---

## 14. Product Features

### User Management

- Registration
- Login
- JWT authentication
- Password hashing
- Protected resources
- User-specific file access

### File Management

- File upload
- File download
- File deletion
- File restoration
- Rename
- Move
- Folder creation
- Folder navigation
- Search
- Filtering
- File preview

### Sharing

- File sharing
- User-based permissions
- Public/private access
- Shared file management

### Storage

- Storage quota
- Storage usage
- File size information
- Recent files
- Activity history

### Multi-Device

- Browser-based access
- Multiple simultaneous clients
- Centralized file access

---

## 12. Distributed-System Features

StorageHive goes beyond normal file-management functionality by exposing the underlying distributed architecture.

The system will demonstrate:

- HDFS-based storage
- NameNode
- Multiple DataNodes
- HDFS blocks
- Configurable replication
- Distributed block storage
- DataNode health
- Storage utilization
- Node failure
- Fault tolerance
- Recovery
- Cluster monitoring
- Horizontal scalability concepts

---

## 13. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Distributed Storage | Apache Hadoop HDFS |
| HDFS Communication | WebHDFS |
| Containerization | Docker + Docker Compose |
| Authentication | JWT + bcrypt |
| File Processing | Node.js Streams |
| API Testing | Postman / Thunder Client |

---

## 14. System Design Principles

StorageHive is designed around several important system-design principles.

### Separation of Responsibilities

Each component has a defined responsibility.

### Stateless Application Layer

The backend should avoid storing application state locally whenever possible.

This makes it easier to scale the application layer independently from the storage layer.

### Storage Abstraction

Application logic should interact with HDFS through a dedicated storage service instead of directly embedding HDFS operations throughout the application.

### Metadata/Data Separation

PostgreSQL manages application metadata while HDFS manages actual file contents.

### Containerized Infrastructure

Docker provides a consistent environment for running the distributed components.

---

## 15. Scalability Concept

One of the important concepts demonstrated by StorageHive is **horizontal scaling**.

Instead of depending entirely on a larger single storage machine:

```text
Single Server
     │
     ▼
Large Disk
```

the architecture can expand by introducing additional storage nodes:

```text
           HDFS Cluster
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
    DN1        DN2        DN3
                           │
                           ▼
                         DN4
                           │
                           ▼
                         DN5
```

Adding nodes increases the available distributed storage resources and demonstrates the basic concept of scaling a distributed system horizontally.

---

## 16. Security Considerations

StorageHive will include application-level security mechanisms such as:

- Password hashing
- JWT-based authentication
- Protected API routes
- User authorization
- File ownership checks
- Sharing permissions
- Input validation
- Environment-based configuration
- Restricted administrative access

Security will be considered separately from HDFS's internal storage and cluster mechanisms.

---

## 17. Learning & Engineering Goals

StorageHive is intended to provide practical understanding of:

### Big Data

- Hadoop ecosystem
- HDFS
- Distributed storage
- Replication
- Fault tolerance
- Large-scale storage concepts

### Distributed Systems

- Node-based architecture
- Failure handling
- Replication
- Horizontal scaling
- Service separation
- Monitoring
- Recovery

### System Design

- Client-server architecture
- Layered architecture
- REST APIs
- Metadata separation
- Storage abstraction
- Stateless services
- Containerized infrastructure
- Observability

### Full-Stack Development

- React
- Node.js
- REST APIs
- PostgreSQL
- Authentication
- File streaming
- Docker

---

## 26. Project Status

**StorageHive is currently under development.**

Development begins with the distributed storage infrastructure rather than the user interface.

The first milestone is to establish a working Docker-based HDFS cluster with a NameNode and multiple DataNodes, verify replication, and demonstrate basic node failure behavior.

The application layer will then be built on top of this infrastructure.

---

## License

This project is developed for academic, learning, and demonstration purposes.
