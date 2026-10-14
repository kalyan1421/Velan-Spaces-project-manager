"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  STAFF_QUERY_KEY,
  accountsApi,
  mergeStaffUpdate,
  type CreateStaffBody,
  type StaffMember,
  type UpdateStaffBody,
} from "@/lib/api/accounts";

/** `GET /staff` (head: managers + workers), seeded from the server render. */
export function useStaff(initialStaff: StaffMember[]) {
  return useQuery({
    queryKey: STAFF_QUERY_KEY,
    queryFn: () => accountsApi.listStaff(),
    initialData: initialStaff,
  });
}

function useStaffCache() {
  const queryClient = useQueryClient();
  return {
    update(updater: (list: StaffMember[]) => StaffMember[]) {
      queryClient.setQueryData<StaffMember[]>(STAFF_QUERY_KEY, (old) => updater(old ?? []));
    },
    /** Background refetch so counts/assignments match the server. */
    refresh() {
      void queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEY });
    },
  };
}

export function useCreateStaff() {
  const cache = useStaffCache();
  return useMutation({
    mutationFn: (body: CreateStaffBody) => accountsApi.createStaff(body),
    onSuccess: (created) => {
      if (created?.id) cache.update((list) => [...list.filter((m) => m.id !== created.id), { ...created, assignedProjects: created.assignedProjects ?? [] }]);
      cache.refresh();
    },
  });
}

export function useUpdateStaff() {
  const cache = useStaffCache();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStaffBody }) => accountsApi.updateStaff(id, body),
    onSuccess: (updated, { id, body }) => {
      cache.update((list) => list.map((m) => (m.id === id ? mergeStaffUpdate(m, updated ?? body) : m)));
      cache.refresh();
    },
  });
}

export function useDeleteStaff() {
  const cache = useStaffCache();
  return useMutation({
    mutationFn: (id: string) => accountsApi.deleteStaff(id),
    onSuccess: (_result, id) => {
      cache.update((list) => list.filter((m) => m.id !== id));
      cache.refresh();
    },
  });
}

export function useCreateResetLink() {
  // The link is shown once and never cached: it is a credential.
  return useMutation({ mutationFn: (id: string) => accountsApi.createResetLink(id) });
}
