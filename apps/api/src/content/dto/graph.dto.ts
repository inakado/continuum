export class GraphNodeInputDto {
  unitId!: string;
  position!: {
    x: number;
    y: number;
  };
}

export class GraphEdgeInputDto {
  fromUnitId!: string;
  toUnitId!: string;
}

export class UpdateSectionGraphDto {
  nodes!: GraphNodeInputDto[];
  edges!: GraphEdgeInputDto[];
}
