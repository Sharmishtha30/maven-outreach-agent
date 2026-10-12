import {
  queryGeneric,
  mutationGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  internalActionGeneric,
  actionGeneric,
  type QueryBuilder,
  type MutationBuilder,
  type ActionBuilder,
  type DataModelFromSchemaDefinition,
} from "convex/server";
import schema from "./schema";
type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export const query: QueryBuilder<DataModel, "public"> = queryGeneric;
export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
export const internalQuery: QueryBuilder<DataModel, "internal"> =
  internalQueryGeneric;
export const internalMutation: MutationBuilder<DataModel, "internal"> =
  internalMutationGeneric;
export const internalAction: ActionBuilder<DataModel, "internal"> =
  internalActionGeneric;
export const action: ActionBuilder<DataModel, "public"> = actionGeneric;
