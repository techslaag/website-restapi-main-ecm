import { Measurement } from "@prisma/client";

export default interface IMeasurement {
  id: string;
  name: string;
  notation: string;
  type: "Energie" | "Produit";
  createdAt: Date;
  updatedAt?: Date | null;
}

export function toIMeasurement(
  item: Pick<
    Measurement,
    "id" | "name" | "notation" | "type" | "createdAt" | "updatedAt"
  >,
): IMeasurement {
  return {
    id: item.id,
    name: item.name,
    notation: item.notation,
    type: item.type === "Energy" ? "Energie" : "Produit",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
