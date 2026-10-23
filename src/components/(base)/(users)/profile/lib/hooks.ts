"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProfileById,
  getUserAuthData,
  updateProfile,
  updateUserCredentials,
} from "./actions";
import { ProfileFormValues } from "./schemas";

export const useProfile = (userId: string, isEnabled: boolean = true) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfileById(userId),
    enabled: !!userId && isEnabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return {
    profile: data,
    loading: isLoading,
    error,
    refetch,
  };
};

export const useUserCredentials = (
  userId: string,
  isEnabled: boolean = true,
) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["credentials", userId],
    queryFn: () => getUserAuthData(userId),
    enabled: !!userId && isEnabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return {
    credentials: data,
    loading: isLoading,
    error,
    refetch,
  };
};

export const useProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<ProfileFormValues>;
    }) => {
      return await updateProfile(userId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["profile", variables.userId],
      });
    },
  });
};

export const useCredentialsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      username,
      password,
    }: {
      userId: string;
      username?: string;
      password?: string;
    }) => {
      return await updateUserCredentials(userId, username, password);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["credentials", variables.userId],
      });
    },
  });
};
