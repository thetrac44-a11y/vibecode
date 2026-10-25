-- Chạy đoạn SQL này trong mục SQL Editor trên Supabase (supabase.com)

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (phone ~ '^(0|\+84)[0-9]{9}$'),
  plan_chosen text not null,
  needs jsonb,
  created_at timestamptz not null default now()
);

-- Bật Row Level Security (RLS)
alter table public.leads enable row level security;

-- Khách (ẩn danh) chỉ được THÊM, không được đọc/sửa/xoá
create policy "Anyone can insert leads"
  on public.leads for insert
  to anon
  with check (true);

-- Chỉ người đã đăng nhập (chủ shop / admin) mới được xem và xoá
create policy "Authenticated can read leads"
  on public.leads for select
  to authenticated
  using (true);

create policy "Authenticated can delete leads"
  on public.leads for delete
  to authenticated
  using (true);
