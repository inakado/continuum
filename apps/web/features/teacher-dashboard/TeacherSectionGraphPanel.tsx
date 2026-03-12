"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  addEdge,
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  getSmoothStepPath,
  type Connection,
  type Edge,
  type EdgeProps,
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
import FieldLabel from "@/components/ui/FieldLabel";
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

const EDGE_DEFAULT_COLOR = "var(--border-primary)";
const EDGE_SELECTED_COLOR = "var(--graph-edge-selected)";
const EDGE_SNAP_THRESHOLD = 18;
const EDGE_PATH_OPTIONS = {
  borderRadius: 14,
  offset: 20,
};

const getEdgeMarkerEnd = (color: string) => ({
  type: MarkerType.ArrowClosed,
  color,
});

const getEdgeStyle = (selected: boolean) => ({
  stroke: selected ? EDGE_SELECTED_COLOR : EDGE_DEFAULT_COLOR,
  strokeWidth: selected ? 3 : 2,
  filter: selected ? "drop-shadow(0 0 6px color-mix(in srgb, var(--graph-edge-selected) 38%, transparent))" : "none",
});

const decorateEdge = (edge: Edge, selected: boolean): Edge => ({
  ...edge,
  markerEnd: getEdgeMarkerEnd(selected ? EDGE_SELECTED_COLOR : EDGE_DEFAULT_COLOR),
  style: getEdgeStyle(selected),
  animated: selected,
});

const getSnappedEdgeCoords = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: Pick<EdgeProps, "sourceX" | "sourceY" | "sourcePosition" | "targetX" | "targetY" | "targetPosition">) => {
  const isVerticalFlow =
    (sourcePosition === Position.Bottom || sourcePosition === Position.Top) &&
    (targetPosition === Position.Bottom || targetPosition === Position.Top);
  if (isVerticalFlow && Math.abs(sourceX - targetX) <= EDGE_SNAP_THRESHOLD) {
    const snappedX = (sourceX + targetX) / 2;
    return { sourceX: snappedX, sourceY, targetX: snappedX, targetY };
  }

  const isHorizontalFlow =
    (sourcePosition === Position.Left || sourcePosition === Position.Right) &&
    (targetPosition === Position.Left || targetPosition === Position.Right);
  if (isHorizontalFlow && Math.abs(sourceY - targetY) <= EDGE_SNAP_THRESHOLD) {
    const snappedY = (sourceY + targetY) / 2;
    return { sourceX, sourceY: snappedY, targetX, targetY: snappedY };
  }

  return { sourceX, sourceY, targetX, targetY };
};

const AlignedSmoothStepEdge = ({
  id,
  markerEnd,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps) => {
  const snappedCoords = getSnappedEdgeCoords({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [edgePath] = getSmoothStepPath({
    ...snappedCoords,
    sourcePosition,
    targetPosition,
    ...EDGE_PATH_OPTIONS,
  });

  return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />;
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
  type: "alignedSmoothStep",
  markerEnd: getEdgeMarkerEnd(EDGE_DEFAULT_COLOR),
  style: getEdgeStyle(false),
};

const NODE_TYPES = { unit: UnitNode };
const EDGE_TYPES: EdgeTypes = { alignedSmoothStep: AlignedSmoothStepEdge };

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
    type: "alignedSmoothStep",
    markerEnd: getEdgeMarkerEnd(EDGE_DEFAULT_COLOR),
    style: getEdgeStyle(false),
  }));

const buildFlowNode = (
  unit: {
    id: string;
    title: string;
    status: "draft" | "published";
    createdAt: string;
  },
  position: { x: number; y: number },
): Node<UnitNodeData> => ({
  id: unit.id,
  type: "unit",
  position,
  style: { border: "none", background: "transparent", padding: 0 },
  data: { title: unit.title, status: unit.status, createdAt: unit.createdAt },
});

const getNextPosition = (count: number) => {
  const columns = 4;
  const stepX = 240;
  const stepY = 180;
  const col = count % columns;
  const row = Math.floor(count / columns);
  return { x: col * stepX, y: row * stepY };
};

const useTeacherSectionGraphEditor = (graph: SectionGraphResponse | undefined) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<UnitNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const applyGraph = useCallback(
    (nextGraph: SectionGraphResponse) => {
      setNodes(buildFlowNodes(nextGraph.nodes));
      setEdges(buildFlowEdges(nextGraph.edges));
      setSelectedEdgeId(null);
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    if (!graph) return;
    applyGraph(graph);
  }, [applyGraph, graph]);

  const appendLocalUnit = useCallback(
    (unit: { id: string; title: string; status: "draft" | "published"; createdAt: string }) => {
      setNodes((current: Node<UnitNodeData>[]) =>
        current.concat(buildFlowNode(unit, getNextPosition(current.length))),
      );
    },
    [setNodes],
  );

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return false;
    setEdges((current: Edge[]) => current.filter((edge: Edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    return true;
  }, [selectedEdgeId, setEdges]);

  const graphPayload = useMemo(
    () => ({
      nodes: nodes.map((node) => ({ unitId: node.id, position: node.position })),
      edges: edges.map((edge) => ({ fromUnitId: edge.source, toUnitId: edge.target })),
    }),
    [edges, nodes],
  );

  return {
    nodes,
    edges,
    selectedEdgeId,
    onNodesChange,
    onEdgesChange,
    setEdges,
    setSelectedEdgeId,
    applyGraph,
    appendLocalUnit,
    deleteSelectedEdge,
    graphPayload,
  };
};

const useTeacherSectionGraphActions = ({
  authRequired,
  queryClient,
  sectionId,
  editor,
  setAuthRequired,
  setIsCreatePopupOpen,
  setNewUnitTitle,
}: {
  authRequired: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  sectionId: string;
  editor: ReturnType<typeof useTeacherSectionGraphEditor>;
  setAuthRequired: (value: boolean) => void;
  setIsCreatePopupOpen: (value: boolean) => void;
  setNewUnitTitle: (value: string) => void;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleApiError = useCallback(
    (err: unknown) => {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") {
        setAuthRequired(true);
      }
      setError(message);
    },
    [setAuthRequired],
  );

  const saveGraphMutation = useMutation({
    mutationFn: () => teacherApi.updateSectionGraph(sectionId, editor.graphPayload),
    onSuccess: (graph) => {
      editor.applyGraph(graph);
      queryClient.setQueryData(contentQueryKeys.teacherSectionGraph(sectionId), graph);
      setStatus("Граф сохранён");
      setError(null);
    },
    onError: handleApiError,
  });

  const createUnitMutation = useMutation({
    mutationFn: (title: string) =>
      teacherApi.createUnit({
        sectionId,
        title,
        sortOrder: editor.nodes.length,
      }),
    onSuccess: (unit) => {
      editor.appendLocalUnit(unit);
      setNewUnitTitle("");
      setIsCreatePopupOpen(false);
      setStatus("Юнит создан. Не забудьте сохранить граф.");
      setError(null);
    },
    onError: handleApiError,
  });

  const saveGraph = useCallback(async () => {
    if (authRequired) return;
    setStatus(null);
    setError(null);
    await saveGraphMutation.mutateAsync();
  }, [authRequired, saveGraphMutation]);

  const createUnit = useCallback(
    async (title: string) => {
      if (authRequired) return;
      const normalizedTitle = title.trim();
      if (!normalizedTitle) return;
      setStatus(null);
      setError(null);
      await createUnitMutation.mutateAsync(normalizedTitle);
    },
    [authRequired, createUnitMutation],
  );

  const deleteSelectedEdge = useCallback(() => {
    setStatus(null);
    setError(null);
    if (!editor.deleteSelectedEdge()) return;
    setStatus("Ребро удалено локально. Не забудьте сохранить граф.");
  }, [editor]);

  const clearFeedback = useCallback(() => {
    setStatus(null);
    setError(null);
  }, []);

  const setLocalError = useCallback((message: string) => {
    setStatus(null);
    setError(message);
  }, []);

  return {
    error,
    status,
    saveGraph,
    createUnit,
    deleteSelectedEdge,
    clearFeedback,
    setLocalError,
    savePending: saveGraphMutation.isPending,
    createPending: createUnitMutation.isPending,
  };
};

const useTeacherSectionGraphQueries = ({
  authRequired,
  courseTitle,
  sectionId,
  sectionTitle,
}: {
  authRequired: boolean;
  courseTitle?: string | null;
  sectionId: string;
  sectionTitle?: string | null;
}) => {
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

  return {
    graphQuery,
    sectionQuery,
    courseQuery,
    loading: graphQuery.isPending,
    resolvedCourseTitle: courseTitle ?? courseQuery.data?.title ?? null,
    resolvedSectionTitle: sectionTitle ?? sectionQuery.data?.title ?? null,
  };
};

const useTeacherSectionGraphAuthGuard = ({
  courseQuery,
  graphQuery,
  sectionQuery,
  setAuthRequired,
}: {
  courseQuery: ReturnType<typeof useTeacherSectionGraphQueries>["courseQuery"];
  graphQuery: ReturnType<typeof useTeacherSectionGraphQueries>["graphQuery"];
  sectionQuery: ReturnType<typeof useTeacherSectionGraphQueries>["sectionQuery"];
  setAuthRequired: (value: boolean) => void;
}) => {
  useEffect(() => {
    const message =
      graphQuery.isError
        ? getApiErrorMessage(graphQuery.error)
        : sectionQuery.isError
          ? getApiErrorMessage(sectionQuery.error)
          : courseQuery.isError
            ? getApiErrorMessage(courseQuery.error)
            : null;
    if (message === "Перелогиньтесь") {
      setAuthRequired(true);
    }
  }, [
    courseQuery.error,
    courseQuery.isError,
    graphQuery.error,
    graphQuery.isError,
    sectionQuery.error,
    sectionQuery.isError,
    setAuthRequired,
  ]);
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
      minZoom={0.1}
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
  const [authRequired, setAuthRequired] = useState(false);
  const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState("");
  const createTitleInputRef = useRef<HTMLInputElement | null>(null);
  const { graphQuery, sectionQuery, courseQuery, loading, resolvedCourseTitle, resolvedSectionTitle } =
    useTeacherSectionGraphQueries({
      authRequired,
      courseTitle,
      sectionId,
      sectionTitle,
    });
  const editor = useTeacherSectionGraphEditor(graphQuery.data);
  useTeacherSectionGraphAuthGuard({ courseQuery, graphQuery, sectionQuery, setAuthRequired });

  useEffect(() => {
    if (!isCreatePopupOpen) return;
    const id = window.setTimeout(() => createTitleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isCreatePopupOpen]);

  const {
    error,
    status,
    saveGraph,
    createUnit,
    deleteSelectedEdge,
    clearFeedback,
    setLocalError,
    savePending,
    createPending,
  } = useTeacherSectionGraphActions({
    authRequired,
    queryClient,
    sectionId,
    editor,
    setAuthRequired,
    setIsCreatePopupOpen,
    setNewUnitTitle,
  });

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      clearFeedback();
      editor.setSelectedEdgeId(null);

      if (connection.source === connection.target) {
        setLocalError("GraphSelfLoopNotAllowed");
        return;
      }

      const nextEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        type: "alignedSmoothStep",
        markerEnd: getEdgeMarkerEnd(EDGE_DEFAULT_COLOR),
        style: getEdgeStyle(false),
      };

      editor.setEdges((current: Edge[]) => {
        if (current.some((edge: Edge) => edge.source === connection.source && edge.target === connection.target)) {
          setLocalError("GraphDuplicateEdgeNotAllowed");
          return current;
        }
        return addEdge(nextEdge, current);
      });
    },
    [clearFeedback, editor, setLocalError],
  );

  const handleSelectionChange = useCallback((selection: { edges?: Edge[]; nodes?: Node[] }) => {
    editor.setSelectedEdgeId(selection.edges?.[0]?.id ?? null);
  }, [editor]);

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
  const canvasEdges = useMemo(
    () => editor.edges.map((edge) => decorateEdge(edge, edge.id === editor.selectedEdgeId)),
    [editor.edges, editor.selectedEdgeId],
  );

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
        <div className={styles.graphOverlay}>
          <div className={styles.graphToolbar}>
            <Button onClick={() => setIsCreatePopupOpen(true)}>Создать юнит</Button>
            <Button variant="secondary" onClick={() => void saveGraph()} disabled={savePending}>
              Сохранить граф
            </Button>
            <Button variant="danger" onClick={deleteSelectedEdge} disabled={!editor.selectedEdgeId}>
              Удалить ребро
            </Button>
          </div>

          {editor.selectedEdgeId ? (
            <div className={styles.selectionHint}>Выбрано ребро. Можно удалить и затем сохранить граф.</div>
          ) : null}
        </div>

        <Dialog
          open={isCreatePopupOpen}
          onOpenChange={setIsCreatePopupOpen}
          title="Создание юнита"
          className={styles.createPopup}
        >
          <FieldLabel className={styles.popupLabel} label="Название юнита">
            <Input
              ref={createTitleInputRef}
              value={newUnitTitle}
              onChange={(event) => setNewUnitTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createUnit(newUnitTitle);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsCreatePopupOpen(false);
                }
              }}
              name="unitTitle"
              autoComplete="off"
              placeholder="Например, Кинематика…"
            />
          </FieldLabel>
          <div className={styles.popupActions}>
            <Button onClick={() => void createUnit(newUnitTitle)} disabled={!newUnitTitle.trim() || createPending}>
              Создать
            </Button>
            <Button variant="secondary" onClick={() => setIsCreatePopupOpen(false)}>
              Отмена
            </Button>
          </div>
        </Dialog>

        {loading ? (
          <div className={styles.loading}>Загрузка графа…</div>
        ) : (
          <>
            <div className={styles.graphCanvas}>
            <GraphCanvas
              nodes={editor.nodes}
              edges={canvasEdges}
              onNodesChange={editor.onNodesChange}
              onEdgesChange={editor.onEdgesChange}
              onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onSelectionChange={handleSelectionChange}
              />
            </div>
            {editor.nodes.length === 0 ? (
              <div className={styles.empty}>В разделе нет юнитов. Создайте первый юнит вверху графа.</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
