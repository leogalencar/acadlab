import { prisma } from "@/lib/prisma";
import type { SerializableSoftware } from "@/features/software-management/types";

export async function getSoftwareCatalog(): Promise<SerializableSoftware[]> {
  const softwareList = await prisma.software.findMany({
    orderBy: [
      { name: "asc" },
      { version: "asc" },
    ],
  });

  return softwareList.map((software) => ({
    id: software.id,
    name: software.name,
    version: software.version,
    supplier: software.supplier,
    createdAt: software.createdAt.toISOString(),
    updatedAt: software.updatedAt.toISOString(),
  }));
}
