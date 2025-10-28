import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import backend from "~backend/client";

export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  
  return useMemo(() => {
    if (!isSignedIn) {
      return backend;
    }
    return backend.with({
      auth: async () => {
        const token = await getToken();
        return { authorization: `Bearer ${token}` };
      }
    });
  }, [isSignedIn, getToken]);
}
