import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export const useConversation = (id: Id<"conversations"> | null)=> {
    return useQuery(api.conversations.getById, id ? {id}: "skip")
}

export const useConversations = () => {
  return useQuery(api.conversations.getByOwner);
};

export const useCreateConversation = () => {
    return useMutation(api.conversations.create);
}

export const useCreateMessageUser = () => {
    return useMutation(api.messages.createMessageUser);
}

export const useUpdateAssistantMessage = () => {
    return useMutation(api.messages.updateAssistantMessage);
}

export const useMessages = (
  conversationId: Id<"conversations"> | null
) => {
  return useQuery(
    api.messages.getMessages,
    conversationId
      ? { conversationId }
      : "skip"
  );
};

export const useRecentMessages = (
  conversationId: Id<"conversations"> | null
) => {
  return useQuery(
    api.messages.getRecentMessages,
    conversationId
      ? { conversationId }
      : "skip"
  );
};
