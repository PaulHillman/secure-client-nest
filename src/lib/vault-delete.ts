/** Remove the listing atomically before touching its stored files. */
export async function deleteVaultRecord(
  deleteRecord: () => Promise<{ data: string[] | null; error: { message: string } | null }>,
  removeStorage: (paths: string[]) => Promise<{ error: { message: string } | null }>,
) {
  const result = await deleteRecord();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Deletion was not confirmed. Please refresh and try again.");
  if (!result.data.length) return { cleanupPending: false };
  try {
    const cleanup = await removeStorage(result.data);
    return { cleanupPending: Boolean(cleanup.error) };
  } catch {
    return { cleanupPending: true };
  }
}