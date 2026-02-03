"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import Link from "next/link";
import StudentShell from "@/components/StudentShell";
import { studentApi, type GraphEdge, type GraphNode } from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentAuthRequired from "../auth/StudentAuthRequired";
import StudentNotFound from "../shared/StudentNotFound";
import { useStudentLogout } from "../auth/use-student-logout";
import styles from "./student-section-detail.module.css";

type Props = {
  sectionId: string;
};

type UnitNodeData = {
  title: string;
  status: "draft" | "published";
};

const UnitNode = ({ data }: NodeProps<UnitNodeData>) => {
  return (
    <div className={styles.node}>
      <div className={styles.nodeTitle}>{data.title}</div>
      <div className={styles.nodeStatus}>{data.status === "published" ? "Опубликован" : "Черновик"}</div>
    </div>
  );
};

const buildFlowNodes = (nodes: GraphNode[]): Node<UnitNodeData>[] =>
  nodes.map((node) => ({
    id: node.unitId,
    type: "unit",
    position: node.position,
    style: { border: "none", background: "transparent", padding: 0 },
    data: { title: node.title, status: node.status },
  }));

const buildFlowEdges = (edges: GraphEdge[]): Edge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.fromUnitId,
    target: edge.toUnitId,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
    style: { stroke: "var(--border-primary)" },
  }));

export default function StudentSectionDetailScreen({ sectionId }: Props) {
  const router = useRouter();
  const handleLogout = useStudentLogout();
  const [nodes, setNodes] = useState<Node<UnitNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchGraph = useCallback(async () => {
    if (authRequired) return;
    setError(null);
    setNotFound(false);
    setLoading(true);
    try {
      const graph = await studentApi.getSectionGraph(sectionId);
      setNodes(buildFlowNodes(graph.nodes));
      setEdges(buildFlowEdges(graph.edges));
    } catch (err) {
      const message = getStudentErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      if (message === "Не найдено или недоступно") setNotFound(true);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authRequired, sectionId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const nodeTypes = useMemo(() => ({ unit: UnitNode }), []);

  if (authRequired) {
    return (
      <StudentShell title="Раздел" onLogout={handleLogout}>
        <StudentAuthRequired />
      </StudentShell>
    );
  }

  return (
    <StudentShell title="Раздел" subtitle="Граф юнитов" onLogout={handleLogout}>
      <div className={styles.topActions}>
        <Link href="/student/courses">← Все курсы</Link>
      </div>

      {notFound ? <StudentNotFound /> : null}
      {error && !notFound ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.graphPanel}>
        {loading ? (
          <div className={styles.loading}>Загрузка графа...</div>
        ) : nodes.length === 0 ? (
          <div className={styles.empty}>В разделе пока нет опубликованных юнитов</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            onNodeClick={(_, node) => router.push(`/student/units/${node.id}`)}
            fitView
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
              style: { stroke: "var(--border-primary)" },
            }}
          >
            <Background gap={20} color="var(--border-primary)" />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </StudentShell>
  );
}
