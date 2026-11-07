import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const setStudentWithdrawal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ studentId: z.string().uuid(), withdrawn: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('set_student_withdrawal', { _student_id: data.studentId, _withdrawn: data.withdrawn });
    if (error) throw new Error(error.message);
    return { withdrawn: data.withdrawn };
  });