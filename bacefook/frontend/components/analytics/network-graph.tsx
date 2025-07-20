"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Frown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError, type NetworkEdge } from "@/lib/api"

import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "reactflow"

import "reactflow/dist/style.css"

interface CustomNodeData {
  label: string;
  type: "main" | "referrer" | "referred" | "friend";
  color: string;
}

// --- Reverted Node Design to Squares ---
function CustomNode({ data }: NodeProps<CustomNodeData>) {
  return (
    <div className="flex flex-col items-center w-24">
      {/* Handles are still here but invisible */}
      <Handle type="target" position={Position.Top} className="!bg-transparent" />
      
      {/* Reverted to a simple square div with a background color */}
      <div
        style={{ backgroundColor: data.color }}
        className="w-24 h-24 rounded-md shadow-lg border-2 border-white"
      />

      <div
        style={{ color: data.color }}
        className="mt-2 text-center text-sm font-bold"
      >
        {data.label}
        {data.type === "main" && (
          <span className="block text-xs text-muted-foreground font-medium">(You)</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-transparent" />
    </div>
  );
}


const nodeTypes = { custom: CustomNode };


export function NetworkGraph() {
  const [username, setUsername] = useState("user09193");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const fetchAndGenerateGraph = useCallback(async (userToQuery: string) => {
    if (!userToQuery.trim()) {
      setError("Please enter a username");
      setIsLoading(false)
      return;
    }
    setIsLoading(true);
    setError(null);
    setNodes([]);
    setEdges([]);

    try {
      const networkData = await api.getNetworkConnections(userToQuery.trim());
      
      const initialNodes: Node<CustomNodeData>[] = [];
      const initialEdges: Edge[] = [];
      
      const horizontalSpacing = 150;
      const verticalSpacing = 200;
      const centerX = 0;

      initialNodes.push({
        id: userToQuery,
        type: 'custom',
        position: { x: centerX, y: verticalSpacing },
        data: { label: userToQuery, type: 'main', color: '#8b5cf6' },
      });

      const referrerEdge = networkData.find(e => e.to === userToQuery && e.type === "Referred");
      if (referrerEdge) {
        initialNodes.push({
          id: referrerEdge.from,
          type: 'custom',
          position: { x: centerX, y: 0 },
          data: { label: referrerEdge.from, type: 'referrer', color: '#f59e0b' },
        });
        initialEdges.push({
          id: `${referrerEdge.from}-${referrerEdge.to}`,
          source: referrerEdge.from,
          target: referrerEdge.to,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#f59e0b', strokeWidth: 2 },
        });
      }
      
      const outgoingEdges = networkData
        .filter(edge => edge.from === userToQuery)
        .sort((a, b) => a.to.localeCompare(b.to));

      const startX = centerX - ((outgoingEdges.length - 1) * horizontalSpacing) / 2;

      outgoingEdges.forEach((edge, index) => {
        const isFriend = edge.type === 'Friend';
        const color = isFriend ? '#06b6d4' : '#f59e0b';
        const yOffset = (index % 2) * 80;

        initialNodes.push({
          id: edge.to,
          type: 'custom',
          position: { 
            x: startX + index * horizontalSpacing, 
            y: (verticalSpacing * 2) + yOffset
          },
          data: { label: edge.to, type: isFriend ? 'friend' : 'referred', color },
        });
        initialEdges.push({
          id: `${edge.from}-${edge.to}`,
          source: edge.from,
          target: edge.to,
          type: 'smoothstep',
          style: { stroke: color, strokeWidth: 2 },
        });
      });

      setNodes(initialNodes);
      setEdges(initialEdges);
      setError(null);

    } catch (err) {
      console.error("Failed to fetch network data:", err);
      if (err instanceof ApiError) {
        setError(err.status === 404 ? "User not found or has no connections." : `Error: ${err.message}`);
      } else {
        setError("Failed to load network data. Check the API server.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchAndGenerateGraph(username);
  }, []);

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAndGenerateGraph(username);
  };

  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-primary">Relationship Network</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleQuery} className="flex items-end gap-4 mb-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="username-input">Username</Label>
            <Input
              id="username-input"
              type="text"
              placeholder="e.g., user09193"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Query
          </Button>
        </form>

        <div className="h-[650px] w-full rounded-lg border bg-muted p-4 relative">
          {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
          )}
          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center text-muted-foreground">
                    <Frown className="mx-auto h-12 w-12 mb-2 text-primary" />
                    <p>{error}</p>
                </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            className="bg-muted"
          >
            <Controls />
            <Background />
          </ReactFlow>
          
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 border z-10">
            <div className="text-sm font-medium mb-2">Legend</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-[#8b5cf6]"></div><span>Queried User</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-[#f59e0b]"></div><span>Referrer/Referred</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-[#06b6d4]"></div><span>Friend</span></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}