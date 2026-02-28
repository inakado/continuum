"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
  type EdgeTypes,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Input from "@/components/ui/Input";
import { teacherApi, type GraphEdge, type GraphNode, type SectionGraphResponse } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { getContentStatusLabel } from "@/lib/status-labels";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";
import AuthRequired from "@/features/teacher-content/auth/AuthRequired";
import styles from "./teacher-section-graph-panel.module.css";

type Props = {
  sectionId: string;
  courseTitle?: string | null;
  sectionTitle?: string | null;
  onBackToSections?: () => void;
  onBackToCourses?: () => void;
};

type UnitNodeData = {
  title: string;
  status: "draft" | "published";
  createdAt: string;
};

const UnitNode = ({ data }: NodeProps<UnitNodeData>) => {
  const createdAtLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(data.createdAt));

  return (
    <div className={styles.node}>
      <Handle
        type="target"
        position={Position.Top}
        className={`${styles.handle} ${styles.handleTop}`}
      />
      <div className={styles.nodeTitle}>{data.title}</div>
      <div className={styles.nodeStatus}>{getContentStatusLabel(data.status)}</div>
      <div className={styles.nodeMeta}>Создан: {createdAtLabel}</div>
      <div className={styles.nodeConnectHint}>Потяните связь отсюда</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${styles.handle} ${styles.handleBottom}`}
      />
    </div>
  );
};

const DEFAULT_EDGE_OPTIONS: Partial<Edge> = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
  style: { stroke: "var(--border-primary)" },
};

const NODE_TYPES = { unit: UnitNode };
const EDGE_TYPES: EdgeTypes = {};

const buildFlowNodes = (nodes: GraphNode[]): Node<UnitNodeData>[] =>
  nodes.map((node) => ({
    id: node.unitId,
    type: "unit",
    position: node.position,
    style: { border: "none", background: "transparent", padding: 0 },
    data: { title: node.title, status: node.status, createdAt: node.createdAt },
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
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick: NodeMouseHandler;
  onSelectionChange: OnSelectionChangeFunc;
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
  const handleFlowError = useCallback((code: string, message: string) => {
    // React Flow #002 can be noisy in dev strict/dynamic render paths.
    if (process.env.NODE_ENV === "development" && code === "002") {
      return;
    }
    // Keep other warnings visible.
    console.warn(`[React Flow]: ${message}`);
  }, []);

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
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      fitView
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      onError={handleFlowError}
    >
      <Background gap={22} size={1} color="color-mix(in srgb, var(--text-muted) 30%, transparent)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
});

export default function TeacherSectionGraphPanel({
  sectionId,
  courseTitle,
  sectionTitle,
  onBackToSections,
  onBackToCourses,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<UnitNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
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

  const graphQuery = useQuery({
    queryKey: contentQueryKeys.teacherSectionGraph(sectionId),
    queryFn: () => teacherApi.getSectionGraph(sectionId),
    enabled: !authRequired,
  });
  const sectionQuery = useQuery({
    queryKey: contentQueryKeys.teacherSection(sectionId),
    queryFn: () => teacherApi.getSection(sectionId),
    enabled: !authRequired,
  });
  const sectionCourseId = sectionQuery.data?.courseId;
  const courseQuery = useQuery({
    queryKey: contentQueryKeys.teacherCourse(sectionCourseId ?? ""),
    queryFn: () => teacherApi.getCourse(sectionCourseId as string),
    enabled: !authRequired && !courseTitle && Boolean(sectionCourseId),
  });
  const loading = graphQuery.isPending;

  useEffect(() => {
    setResolvedCourseTitle(courseTitle ?? null);
  }, [courseTitle]);

  useEffect(() => {
    setResolvedSectionTitle(sectionTitle ?? null);
  }, [sectionTitle]);

  useEffect(() => {
    if (!graphQuery.data) return;
    applyGraph(graphQuery.data);
  }, [applyGraph, graphQuery.data]);

  useEffect(() => {
    const message = graphQuery.isError
      ? getApiErrorMessage(graphQuery.error)
      : sectionQuery.isError
        ? getApiErrorMessage(sectionQuery.error)
        : null;
    if (message === "Перелогиньтесь") {
      setAuthRequired(true);
    }
  }, [graphQuery.error, graphQuery.isError, sectionQuery.error, sectionQuery.isError]);

  useEffect(() => {
    if (sectionQuery.data?.title) {
      setResolvedSectionTitle(sectionQuery.data.title);
      return;
    }
    if (sectionQuery.isError && !sectionTitle) {
      setResolvedSectionTitle(null);
    }
  }, [sectionQuery.data?.title, sectionQuery.isError, sectionTitle]);

  useEffect(() => {
    if (courseTitle) return;
    if (courseQuery.data?.title) {
      setResolvedCourseTitle(courseQuery.data.title);
      return;
    }
    if (courseQuery.isError) {
      setResolvedCourseTitle(null);
    }
  }, [courseQuery.data?.title, courseQuery.isError, courseTitle]);

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

      const nextEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
        style: { stroke: "var(--border-primary)" },
      };

      setEdges((current: Edge[]) => {
        if (current.some((edge: Edge) => edge.source === connection.source && edge.target === connection.target)) {
          setError("GraphDuplicateEdgeNotAllowed");
          return current;
        }
        return addEdge(nextEdge, current);
      });
    },
    [setEdges],
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
      queryClient.setQueryData(contentQueryKeys.teacherSectionGraph(sectionId), graph);
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
      setNodes((current: Node<UnitNodeData>[]) =>
        current.concat({
          id: unit.id,
          type: "unit",
          position,
          style: { border: "none", background: "transparent", padding: 0 },
          data: { title: unit.title, status: unit.status, createdAt: unit.createdAt },
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
    setEdges((current: Edge[]) => current.filter((edge: Edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setStatus("Ребро удалено локально. Не забудьте сохранить граф.");
  };

  const handleSelectionChange = useCallback((selection: { edges?: Edge[]; nodes?: Node[] }) => {
    setSelectedEdgeId(selection.edges?.[0]?.id ?? null);
  }, []);

  const handleNodeClick = useCallback(
    (_: ReactMouseEvent, node: Node<UnitNodeData>) => {
      router.push(`/teacher/units/${node.id}`);
    },
    [router],
  );

  const handleBackToSections = useCallback(() => {
    if (onBackToSections) {
      onBackToSections();
      return;
    }
    router.push("/teacher");
  }, [onBackToSections, router]);

  const handleBackToCourses = useCallback(() => {
    if (onBackToCourses) {
      onBackToCourses();
      return;
    }
    router.push("/teacher");
  }, [onBackToCourses, router]);

  if (authRequired) {
    return <AuthRequired />;
  }

  const queryError = graphQuery.isError ? getApiErrorMessage(graphQuery.error) : null;
  const errorMessage = error ?? queryError;

  return (
    <div className={styles.wrapper}>
      <div className={styles.breadcrumbs}>
        <button type="button" className={styles.breadcrumbLink} onClick={handleBackToCourses}>
          Курсы
        </button>
        <span className={styles.breadcrumbDivider}>/</span>
        <button type="button" className={styles.breadcrumbLink} onClick={handleBackToSections}>
          {resolvedCourseTitle ?? "Курс"}
        </button>
        <span className={styles.breadcrumbDivider}>/</span>
        <span className={styles.breadcrumbCurrent}>{resolvedSectionTitle ?? "Раздел"}</span>
      </div>

      {errorMessage ? (
        <div className={styles.error} role="status" aria-live="polite">
          {errorMessage}
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

        <Dialog
          open={isCreatePopupOpen}
          onOpenChange={setIsCreatePopupOpen}
          title="Создание юнита"
          className={styles.createPopup}
        >
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
        </Dialog>

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
