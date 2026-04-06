# MindrianRooms -- ICM Layer 1 (Routing)

**Question answered:** "Where do I go?"

## Active Rooms

| Room | Venture | Stage | Status | Last Active |
|------|---------|-------|--------|-------------|

## Archive

| Room | Reason |
|------|--------|

## How to Work in a Room

1. `cd ~/MindrianRooms/[room-name]` then `claude`
2. Or from any session: tell Larry "go to [room name]"
3. `/mos:rooms` manages the registry programmatically

## Room Creation Rule

All new rooms MUST be created under ~/MindrianRooms/. The convention:
- Directory name = kebab-case slug (e.g., `new-venture-name`)
- Each room is self-contained with its own STATE.md, sections, and graph
- Parent (this directory) holds the index; rooms hold the content
