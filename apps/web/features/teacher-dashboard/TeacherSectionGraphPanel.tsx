"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { teacherApi, type GraphEdge, type GraphNode, type SectionGraphResponse } from "@/lib/api/teacher";
import { getContentStatusLabel } from "@/lib/status-labels";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";
import AuthRequired from "@/features/teacher-content/auth/AuthRequired";
import styles from "./teacher-section-graph-panel.module.css";

type Props = {
  sectionId: string;
  courseTitle?: string | null;
  sectionTitle?: string | null;
  onBack?: () => void;
};

type UnitNodeData = {
  title: string;
  status: "draft" | "published";
};

const UnitNode = ({ data }: NodeProps<UnitNodeData>) => {
  return (
    <div className={styles.node}>
      <Handle
        type="target"
        position={Position.Top}
        className={`${styles.handle} ${styles.handleTop}`}
      />
      <div className={styles.nodeTitle}>{data.title}</div>
      <div className={styles.nodeStatus}>{getContentStatusLabel(data.status)}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${styles.handle} ${styles.handleBottom}`}
      />
    </div>
  );
};

const NODE_TYPES = { unit: UnitNode };

const DEFAULT_EDGE_OPTIONS: Partial<Edge> = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
  style: { stroke: "var(--border-primary)" },
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

const getNextPosition = (count: number) => {
  const columns = 4;
  const stepX = 240;
  const stepY = 180;
  const col = count % columns;
  const row = Math.floor(count / columns);
  return { x: col * stepX, y: row * stepY };
};

type GraphCanvasProps = {
  nodes: Node<UnitNodeData>[];
  edges: Edge[];
  onNodesChange: (...args: any[]) => void;
  onEdgesChange: (...args: any[]) => void;
  onConnect: (...args: any[]) => void;
  onNodeClick: (...args: any[]) => void;
  onSelectionChange: (...args: any[]) => void;
};

const GraphCanvas = memo(function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onSelectionChange,
}: GraphCanvasProps) {
  const nodeTypesRef = useRef(NODE_TYPES);
  const defaultEdgeOptionsRef = useRef(DEFAULT_EDGE_OPTIONS);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onSelectionChange={onSelectionChange}
      proOptions={{ hideAttribution: true }}
      nodeTypes={nodeTypesRef.current}
      fitView
      defaultEdgeOptions={defaultEdgeOptionsRef.current}
    >
      <Background gap={22} size={1} color="color-mix(in srgb, var(--text-muted) 30%, transparent)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
});

export default function TeacherSectionGraphPanel({ sectionId, courseTitle, sectionTitle, onBack }: Props) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<UnitNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [resolvedCourseTitle, setResolvedCourseTitle] = useState<string | null>(courseTitle ?? null);
  const [resolvedSectionTitle, setResolvedSectionTitle] = useState<string | null>(sectionTitle ?? null);
  const createTitleInputRef = useRef<HTMLInputElement | null>(null);

  const applyGraph = useCallback(
    (graph: SectionGraphResponse) => {
      setNodes(buildFlowNodes(graph.nodes));
      setEdges(buildFlowEdges(graph.edges));
      setSelectedEdgeId(null);
    },
    [setEdges, setNodes, setSelectedEdgeId],
  );

  const fetchGraph = useCallback(async () => {
    if (authRequired) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const graph = await teacherApi.getSectionGraph(sectionId);
      applyGraph(graph);
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applyGraph, authRequired, sectionId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  useEffect(() => {
    setResolvedCourseTitle(courseTitle ?? null);
  }, [courseTitle]);

  useEffect(() => {
    setResolvedSectionTitle(sectionTitle ?? null);
  }, [sectionTitle]);

  useEffect(() => {
    if (authRequired) return;
    let cancelled = false;

    void (async () => {
      try {
        const section = await teacherApi.getSection(sectionId);
        if (cancelled) return;
        setResolvedSectionTitle(section.title);
        if (!courseTitle) {
          try {
            const course = await teacherApi.getCourse(section.courseId);
            if (cancelled) return;
            setResolvedCourseTitle(course.title);
          } catch {
            if (cancelled) return;
            setResolvedCourseTitle(null);
          }
        }
      } catch {
        if (cancelled) return;
        if (!sectionTitle) setResolvedSectionTitle(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authRequired, courseTitle, sectionId, sectionTitle]);

  useEffect(() => {
    if (!isCreatePopupOpen) return;
    const id = window.setTimeout(() => createTitleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isCreatePopupOpen]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setStatus(null);
      setError(null);

      if (connection.source === connection.target) {
        setError("GraphSelfLoopNotAllowed");
        return;
      }

      if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) {
        setError("GraphDuplicateEdgeNotAllowed");
        return;
      }

      const nextEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
        style: { stroke: "var(--border-primary)" },
      };

      setEdges((current) => addEdge(nextEdge, current));
    },
    [edges, setEdges],
  );

  const handleSave = async () => {
    if (authRequired) return;
    setStatus(null);
    setError(null);
    try {
      const payload = {
        nodes: nodes.map((node) => ({ unitId: node.id, position: node.position })),
        edges: edges.map((edge) => ({ fromUnitId: edge.source, toUnitId: edge.target })),
      };
      const graph = await teacherApi.updateSectionGraph(sectionId, payload);
      applyGraph(graph);
      setStatus("Граф сохранён");
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleCreateUnit = async () => {
    if (authRequired) return;
    if (!newUnitTitle.trim()) return;
    setStatus(null);
    setError(null);
    try {
      const unit = await teacherApi.createUnit({
        sectionId,
        title: newUnitTitle.trim(),
        sortOrder: nodes.length,
      });
      const position = getNextPosition(nodes.length);
      setNodes((current) =>
        current.concat({
          id: unit.id,
          type: "unit",
          position,
          style: { border: "none", background: "transparent", padding: 0 },
          data: { title: unit.title, status: unit.status },
        }),
      );
      setNewUnitTitle("");
      setIsCreatePopupOpen(false);
      setStatus("Юнит создан. Не забудьте сохранить граф.");
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setStatus("Ребро удалено локально. Не забудьте сохранить граф.");
  };

  const handleSelectionChange = useCallback((selection: { edges?: Edge[]; nodes?: Node[] }) => {
    setSelectedEdgeId(selection.edges?.[0]?.id ?? null);
  }, []);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      router.push(`/teacher/units/${node.id}`);
    },
    [router],
  );

  const handleBackToStructure = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    router.push("/teacher");
  }, [onBack, router]);

  if (authRequired) {
    return <AuthRequired />;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.breadcrumbs}>
        <button type="button" className={styles.breadcrumbLink} onClick={handleBackToStructure}>
          Курсы
        </button>
        <span className={styles.breadcrumbDivider}>/</span>
        <button type="button" className={styles.breadcrumbLink} onClick={handleBackToStructure}>
          {resolvedCourseTitle ?? "Курс"}
        </button>
        <span className={styles.breadcrumbDivider}>/</span>
        <span className={styles.breadcrumbCurrent}>{resolvedSectionTitle ?? "Раздел"}</span>
      </div>

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}
      {status ? <div className={styles.status}>{status}</div> : null}

      <div className={styles.graphPanel} aria-busy={loading}>
        <div className={styles.graphToolbar}>
          <Button onClick={() => setIsCreatePopupOpen(true)}>Создать юнит</Button>
          <Button variant="ghost" onClick={handleSave}>
            Сохранить граф
          </Button>
          <Button variant="ghost" onClick={handleDeleteSelectedEdge} disabled={!selectedEdgeId}>
            Удалить ребро
          </Button>
        </div>

        {isCreatePopupOpen ? (
          <div className={styles.createPopup} role="dialog" aria-label="Создание юнита">
            <label className={styles.popupLabel}>
              Название юнита
              <Input
                ref={createTitleInputRef}
                value={newUnitTitle}
                onChange={(event) => setNewUnitTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateUnit();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsCreatePopupOpen(false);
                  }
                }}
                name="unitTitle"
                autoComplete="off"
                placeholder="Например, Кинематика..."
              />
            </label>
            <div className={styles.popupActions}>
              <Button onClick={() => void handleCreateUnit()} disabled={!newUnitTitle.trim()}>
                Создать
              </Button>
              <Button variant="ghost" onClick={() => setIsCreatePopupOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : null}

        {selectedEdgeId ? (
          <div className={styles.selectionHint}>Выбрано ребро. Можно удалить и затем сохранить граф.</div>
        ) : null}

        {loading ? (
          <div className={styles.loading}>Загрузка графа…</div>
        ) : (
          <>
            <div className={styles.graphCanvas}>
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onSelectionChange={handleSelectionChange}
              />
            </div>
            {nodes.length === 0 ? (
              <div className={styles.empty}>В разделе нет юнитов. Создайте первый юнит вверху графа.</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
