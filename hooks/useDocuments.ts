import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export const useDocumentLibrary = () => useQuery(api.documents.listMine);
export const useRegisterUploadedDocument = () => useMutation(api.documents.registerUploaded);
export const useDeleteDocument = () => useMutation(api.documents.deleteMine);
