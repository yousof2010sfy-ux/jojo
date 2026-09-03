-- ==============================================================================
-- 🚀 REFRESH PLATFORM - COMPLETE SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- قم بنسخ كل محتويات هذا الملف ولصقها في:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- تفعيل الامتدادات الضرورية
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 1. جدول الحسابات الشخصية (profiles)
-- ==============================================================================
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text not null,
    phone text unique not null,
    username text unique,
    avatar_url text,
    balance numeric(12,2) default 0.00 check (balance >= 0),
    points integer default 0 check (points >= 0),
    referral_code text unique,
    referred_by uuid references public.profiles(id) on delete set null,
    role text default 'user' check (role in ('user', 'admin')),
    is_blocked boolean default false,
    created_at timestamptz default now()
);

-- ==============================================================================
-- 2. جدول الطلبات (orders)
-- ==============================================================================
create table if not exists public.orders (
    id text primary key default ('ORD-' || upper(substring(md5(random()::text) from 1 for 8))),
    user_id uuid not null references public.profiles(id) on delete cascade,
    service_id text not null,
    content_link text not null,
    quantity integer not null check (quantity > 0),
    total_price numeric(12,2) not null check (total_price >= 0),
    status text default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
    notes text,
    discount_code text,
    points_used integer default 0,
    created_at timestamptz default now()
);

-- ==============================================================================
-- 3. جدول طلبات شحن الرصيد (balance_requests)
-- ==============================================================================
create table if not exists public.balance_requests (
    id text primary key default ('BAL-' || upper(substring(md5(random()::text) from 1 for 8))),
    user_id uuid not null references public.profiles(id) on delete cascade,
    amount numeric(12,2) not null check (amount > 0),
    payment_method text not null,
    transaction_id text not null,
    transfer_to text not null,
    proof_url text,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz default now()
);

-- ==============================================================================
-- 4. جدول رسائل وتذاكر الدعم (messages) والردود
-- ==============================================================================
create table if not exists public.messages (
    id text primary key default ('MSG-' || upper(substring(md5(random()::text) from 1 for 8))),
    user_id uuid not null references public.profiles(id) on delete cascade,
    subject text not null,
    content text not null,
    status text default 'open' check (status in ('open', 'replied', 'resolved', 'closed')),
    created_at timestamptz default now()
);

create table if not exists public.message_replies (
    id uuid primary key default gen_random_uuid(),
    message_id text not null references public.messages(id) on delete cascade,
    content text not null,
    created_at timestamptz default now()
);

create table if not exists public.message_client_replies (
    id uuid primary key default gen_random_uuid(),
    message_id text not null references public.messages(id) on delete cascade,
    content text not null,
    created_at timestamptz default now()
);

-- ==============================================================================
-- 5. جدول الأسئلة الشائعة (faqs)
-- ==============================================================================
create table if not exists public.faqs (
    id uuid primary key default gen_random_uuid(),
    question text not null,
    keywords text,
    answer text not null,
    created_at timestamptz default now()
);

-- ==============================================================================
-- 6. جدول أكواد الخصم (discount_codes)
-- ==============================================================================
create table if not exists public.discount_codes (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
    service_keys text[],
    expires_at timestamptz,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- ==============================================================================
-- 7. جدول إعدادات التطبيق (app_settings)
-- ==============================================================================
create table if not exists public.app_settings (
    key text primary key,
    value text not null,
    description text
);

-- ==============================================================================
-- 8. تكلفة الخدمات وسجل الأرباح (service_costs, profit_history)
-- ==============================================================================
create table if not exists public.service_costs (
    service_key text primary key,
    cost numeric(12,2) default 0.00
);

create table if not exists public.profit_history (
    id uuid primary key default gen_random_uuid(),
    order_id text references public.orders(id) on delete set null,
    amount numeric(12,2) not null default 0.00,
    cost numeric(12,2) not null default 0.00,
    profit numeric(12,2) not null default 0.00,
    created_at timestamptz default now()
);

-- ==============================================================================
-- 9. جدول أسعار صرف العملات (currency_rates)
-- ==============================================================================
create table if not exists public.currency_rates (
    currency_code text primary key,
    rate_per_egp numeric(12,4) not null default 1.0000
);

-- ==============================================================================
-- 10. جدول مستويات ونسب الإحالة (referral_tier_config) وسجل الأرباح
-- ==============================================================================
create table if not exists public.referral_tier_config (
    min_activated_friends integer primary key,
    rate_percent numeric(5,2) not null
);

create table if not exists public.referral_earnings (
    id uuid primary key default gen_random_uuid(),
    referrer_id uuid not null references public.profiles(id) on delete cascade,
    referred_id uuid not null references public.profiles(id) on delete cascade,
    amount numeric(12,2) not null,
    source_order_id text,
    created_at timestamptz default now()
);

-- ==============================================================================
-- 11. جدول نقاط الخدمات (service_points) والجلسات الحية (online_sessions)
-- ==============================================================================
create table if not exists public.service_points (
    service_key text primary key,
    points_value integer not null default 0
);

create table if not exists public.online_sessions (
    session_id text primary key,
    last_seen timestamptz default now()
);

-- ==============================================================================
-- 12. تفعيل الحماية RLS (Row Level Security)
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.balance_requests enable row level security;
alter table public.messages enable row level security;
alter table public.message_replies enable row level security;
alter table public.message_client_replies enable row level security;
alter table public.faqs enable row level security;
alter table public.discount_codes enable row level security;
alter table public.app_settings enable row level security;
alter table public.service_costs enable row level security;
alter table public.profit_history enable row level security;
alter table public.currency_rates enable row level security;
alter table public.referral_tier_config enable row level security;
alter table public.referral_earnings enable row level security;
alter table public.service_points enable row level security;
alter table public.online_sessions enable row level security;

-- دوال فحص الصلاحيات
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- سياسات Profiles
drop policy if exists "Users can read own profile or admins can read all" on public.profiles;
create policy "Users can read own profile or admins can read all" on public.profiles
    for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
    for insert with check (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles
    for update using (public.is_admin());

-- سياسات Orders
drop policy if exists "Users can read own orders or admins read all" on public.orders;
create policy "Users can read own orders or admins read all" on public.orders
    for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert own orders" on public.orders;
create policy "Users can insert own orders" on public.orders
    for insert with check (auth.uid() = user_id);

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders
    for update using (public.is_admin());

drop policy if exists "Admins can delete orders" on public.orders;
create policy "Admins can delete orders" on public.orders
    for delete using (public.is_admin());

-- سياسات Balance Requests
drop policy if exists "Users read own requests or admins read all" on public.balance_requests;
create policy "Users read own requests or admins read all" on public.balance_requests
    for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users insert own balance requests" on public.balance_requests;
create policy "Users insert own balance requests" on public.balance_requests
    for insert with check (auth.uid() = user_id);

drop policy if exists "Admins update balance requests" on public.balance_requests;
create policy "Admins update balance requests" on public.balance_requests
    for update using (public.is_admin());

drop policy if exists "Admins delete balance requests" on public.balance_requests;
create policy "Admins delete balance requests" on public.balance_requests
    for delete using (public.is_admin());

-- سياسات Messages
drop policy if exists "Users read own messages or admins read all" on public.messages;
create policy "Users read own messages or admins read all" on public.messages
    for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users insert messages" on public.messages;
create policy "Users insert messages" on public.messages
    for insert with check (auth.uid() = user_id);

drop policy if exists "Admins update messages" on public.messages;
create policy "Admins update messages" on public.messages
    for update using (public.is_admin());

drop policy if exists "Admins delete messages" on public.messages;
create policy "Admins delete messages" on public.messages
    for delete using (public.is_admin());

drop policy if exists "Read message replies" on public.message_replies;
create policy "Read message replies" on public.message_replies
    for select using (true);

drop policy if exists "Insert admin replies" on public.message_replies;
create policy "Insert admin replies" on public.message_replies
    for insert with check (public.is_admin());

drop policy if exists "Read client replies" on public.message_client_replies;
create policy "Read client replies" on public.message_client_replies
    for select using (true);

drop policy if exists "Insert client replies" on public.message_client_replies;
create policy "Insert client replies" on public.message_client_replies
    for insert with check (auth.uid() is not null);

-- سياسات الجداول العامة للقراءة
drop policy if exists "Public read faqs" on public.faqs;
create policy "Public read faqs" on public.faqs for select using (true);

drop policy if exists "Admins manage faqs" on public.faqs;
create policy "Admins manage faqs" on public.faqs for all using (public.is_admin());

drop policy if exists "Public read app_settings" on public.app_settings;
create policy "Public read app_settings" on public.app_settings for select using (true);

drop policy if exists "Admins manage app_settings" on public.app_settings;
create policy "Admins manage app_settings" on public.app_settings for all using (public.is_admin());

drop policy if exists "Public read currency_rates" on public.currency_rates;
create policy "Public read currency_rates" on public.currency_rates for select using (true);

drop policy if exists "Admins manage currency_rates" on public.currency_rates;
create policy "Admins manage currency_rates" on public.currency_rates for all using (public.is_admin());

drop policy if exists "Public read referral_tier_config" on public.referral_tier_config;
create policy "Public read referral_tier_config" on public.referral_tier_config for select using (true);

drop policy if exists "Admins manage referral_tier_config" on public.referral_tier_config;
create policy "Admins manage referral_tier_config" on public.referral_tier_config for all using (public.is_admin());

drop policy if exists "Public read service_points" on public.service_points;
create policy "Public read service_points" on public.service_points for select using (true);

drop policy if exists "Admins manage service_points" on public.service_points;
create policy "Admins manage service_points" on public.service_points for all using (public.is_admin());

drop policy if exists "Public read service_costs" on public.service_costs;
create policy "Public read service_costs" on public.service_costs for select using (public.is_admin());

drop policy if exists "Admins manage service_costs" on public.service_costs;
create policy "Admins manage service_costs" on public.service_costs for all using (public.is_admin());

drop policy if exists "Admins read profit_history" on public.profit_history;
create policy "Admins read profit_history" on public.profit_history for all using (public.is_admin());

drop policy if exists "Public read discount_codes" on public.discount_codes;
create policy "Public read discount_codes" on public.discount_codes for select using (true);

drop policy if exists "Admins manage discount_codes" on public.discount_codes;
create policy "Admins manage discount_codes" on public.discount_codes for all using (public.is_admin());

drop policy if exists "Public presence manage" on public.online_sessions;
create policy "Public presence manage" on public.online_sessions for all using (true);

drop policy if exists "User read own referral earnings" on public.referral_earnings;
create policy "User read own referral earnings" on public.referral_earnings for select using (auth.uid() = referrer_id or public.is_admin());

-- ==============================================================================
-- 13. الدوال والإجراءات المخزنة (RPC Functions)
-- ==============================================================================

-- فحص هل اليوزر مأخوذ
create or replace function public.is_username_taken(p_username text)
returns boolean language plpgsql security definer as $$
begin
    return exists (select 1 from public.profiles where lower(username) = lower(p_username));
end;
$$;

-- فحص رقم التليفون أو اليوزر للدخول
create or replace function public.resolve_login_identifier(p_identifier text)
returns text language plpgsql security definer as $$
declare
    v_phone text;
begin
    select phone into v_phone from public.profiles where phone = p_identifier or lower(username) = lower(p_identifier) limit 1;
    return coalesce(v_phone, p_identifier);
end;
$$;

-- تحديث الملف الشخصي
create or replace function public.update_my_profile(p_name text, p_phone text, p_username text)
returns public.profiles language plpgsql security definer as $$
declare
    v_profile public.profiles;
begin
    if p_phone is not null and exists (select 1 from public.profiles where phone = p_phone and id <> auth.uid()) then
        raise exception 'رقم الهاتف مستخدم بالفعل من قبل حساب آخر';
    end if;
    if p_username is not null and exists (select 1 from public.profiles where lower(username) = lower(p_username) and id <> auth.uid()) then
        raise exception 'اسم المستخدم مأخوذ بالفعل';
    end if;

    update public.profiles
    set name = coalesce(p_name, name),
        phone = coalesce(p_phone, phone),
        username = coalesce(p_username, username)
    where id = auth.uid()
    returning * into v_profile;

    return v_profile;
end;
$$;

-- تحديث الصورة الشخصية
create or replace function public.update_my_avatar(p_avatar_url text)
returns public.profiles language plpgsql security definer as $$
declare
    v_profile public.profiles;
begin
    update public.profiles
    set avatar_url = p_avatar_url
    where id = auth.uid()
    returning * into v_profile;
    return v_profile;
end;
$$;

-- تطبيق كود الإحالة
create or replace function public.apply_referral_code(p_code text)
returns void language plpgsql security definer as $$
declare
    v_referrer_id uuid;
begin
    select id into v_referrer_id from public.profiles where referral_code = upper(trim(p_code)) and id <> auth.uid();
    if v_referrer_id is not null then
        update public.profiles set referred_by = v_referrer_id where id = auth.uid() and referred_by is null;
    end if;
end;
$$;

-- تقديم طلب جديد (Place Order) مع خصم الرصيد تلقائياً وتسجيل الأرباح والإحالات
create or replace function public.place_order(
    p_service_id text,
    p_content_link text,
    p_quantity integer,
    p_notes text default null,
    p_discount_code text default null,
    p_points_used integer default 0
)
returns public.orders language plpgsql security definer as $$
declare
    v_user public.profiles;
    v_unit_price numeric := 0.05;
    v_base_total numeric;
    v_discount_pct numeric := 0;
    v_final_total numeric;
    v_point_val numeric := 0.05;
    v_discount_val numeric := 0;
    v_new_order public.orders;
    v_cost_unit numeric := 0;
    v_profit numeric := 0;
    v_ref_tier numeric := 5.0;
    v_ref_amount numeric := 0;
begin
    select * into v_user from public.profiles where id = auth.uid();
    if v_user is null then raise exception 'المستخدم غير مسجل'; end if;
    if v_user.is_blocked then raise exception 'تم حظر حسابك، يرجى التواصل مع الدعم'; end if;

    -- حساب السعر المبدئي
    v_base_total := p_quantity * v_unit_price;

    -- كود الخصم إن وجد
    if p_discount_code is not null and trim(p_discount_code) <> '' then
        select percentage into v_discount_pct from public.discount_codes 
        where code = upper(trim(p_discount_code)) and is_active = true and (expires_at is null or expires_at > now()) limit 1;
        if v_discount_pct > 0 then
            v_base_total := v_base_total * (1 - (v_discount_pct / 100));
        end if;
    end if;

    -- خصم النقاط
    if p_points_used > 0 then
        if v_user.points < p_points_used then raise exception 'رصيد النقاط غير كافٍ'; end if;
        select coalesce(value::numeric, 0.05) into v_point_val from public.app_settings where key = 'point_value_egp';
        if v_point_val is null then
            v_point_val := 0.05;
        end if;
        v_discount_val := p_points_used * v_point_val;
        v_base_total := greatest(0, v_base_total - v_discount_val);
    end if;

    v_final_total := round(v_base_total, 2);

    -- فحص رصيد الحساب
    if v_user.balance < v_final_total then
        raise exception 'رصيدك الحالي غير كافٍ لإتمام الطلب. يرجى شحن الرصيد.';
    end if;

    -- خصم الرصيد والنقاط
    update public.profiles 
    set balance = balance - v_final_total,
        points = points - coalesce(p_points_used, 0)
    where id = v_user.id;

    -- إدراج الطلب
    insert into public.orders (user_id, service_id, content_link, quantity, total_price, status, notes, discount_code, points_used)
    values (v_user.id, p_service_id, p_content_link, p_quantity, v_final_total, 'pending', p_notes, p_discount_code, p_points_used)
    returning * into v_new_order;

    -- تسجيل عمولة الإحالة للمُحيل
    if v_user.referred_by is not null and v_final_total > 0 then
        v_ref_amount := round(v_final_total * 0.05, 2);
        if v_ref_amount > 0 then
            update public.profiles set balance = balance + v_ref_amount where id = v_user.referred_by;
            insert into public.referral_earnings (referrer_id, referred_id, amount, source_order_id)
            values (v_user.referred_by, v_user.id, v_ref_amount, v_new_order.id);
        end if;
    end if;

    -- تسجيل الأرباح
    select cost into v_cost_unit from public.service_costs where service_key = p_service_id;
    if v_cost_unit is not null then
        v_profit := v_final_total - (p_quantity * v_cost_unit);
        insert into public.profit_history (order_id, amount, cost, profit)
        values (v_new_order.id, v_final_total, (p_quantity * v_cost_unit), v_profit);
    end if;

    return v_new_order;
end;
$$;

-- إنشاء طلب شحن رصيد
create or replace function public.create_balance_request(
    p_amount numeric,
    p_payment_method text,
    p_transaction_id text,
    p_transfer_to text,
    p_proof_url text default null
)
returns public.balance_requests language plpgsql security definer as $$
declare
    v_req public.balance_requests;
begin
    insert into public.balance_requests (user_id, amount, payment_method, transaction_id, transfer_to, proof_url, status)
    values (auth.uid(), p_amount, p_payment_method, p_transaction_id, p_transfer_to, p_proof_url, 'pending')
    returning * into v_req;
    return v_req;
end;
$$;

-- موافقة الأدمن على شحن الرصيد
create or replace function public.admin_approve_balance_request(p_request_id text)
returns void language plpgsql security definer as $$
declare
    v_req public.balance_requests;
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    select * into v_req from public.balance_requests where id = p_request_id;
    if v_req is null then raise exception 'الطلب غير موجود'; end if;
    if v_req.status = 'approved' then raise exception 'تمت الموافقة على هذا الطلب مسبقاً'; end if;

    update public.balance_requests set status = 'approved' where id = p_request_id;
    update public.profiles set balance = balance + v_req.amount where id = v_req.user_id;
end;
$$;

-- رفض طلب الشحن
create or replace function public.admin_reject_balance_request(p_request_id text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.balance_requests set status = 'rejected' where id = p_request_id;
end;
$$;

-- حذف طلب الشحن
create or replace function public.admin_delete_balance_request(p_request_id text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    delete from public.balance_requests where id = p_request_id;
end;
$$;

-- إضافة رصيد يدوي
create or replace function public.admin_add_balance(p_user_id uuid, p_amount numeric)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.profiles set balance = balance + p_amount where id = p_user_id;
end;
$$;

-- خصم رصيد يدوي
create or replace function public.admin_deduct_balance(p_user_id uuid, p_amount numeric)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.profiles set balance = greatest(0, balance - p_amount) where id = p_user_id;
end;
$$;

-- إدارة حالة الطلبات
create or replace function public.admin_set_order_status(p_order_id text, p_status text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.orders set status = p_status where id = p_order_id;
end;
$$;

create or replace function public.admin_complete_order(p_order_id text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.orders set status = 'completed' where id = p_order_id;
end;
$$;

create or replace function public.admin_cancel_order(p_order_id text)
returns void language plpgsql security definer as $$
declare
    v_order public.orders;
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    select * into v_order from public.orders where id = p_order_id;
    if v_order is not null and v_order.status <> 'cancelled' then
        -- استرجاع الرصيد والنقاط للمستخدم
        update public.profiles 
        set balance = balance + v_order.total_price,
            points = points + coalesce(v_order.points_used, 0)
        where id = v_order.user_id;
        update public.orders set status = 'cancelled' where id = p_order_id;
    end if;
end;
$$;

create or replace function public.admin_delete_order(p_order_id text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    delete from public.orders where id = p_order_id;
end;
$$;

-- إدارة تذاكر الدعم والرسائل
create or replace function public.create_message(p_subject text, p_content text)
returns public.messages language plpgsql security definer as $$
declare
    v_msg public.messages;
begin
    insert into public.messages (user_id, subject, content, status)
    values (auth.uid(), p_subject, p_content, 'open')
    returning * into v_msg;
    return v_msg;
end;
$$;

create or replace function public.client_reply_message(p_message_id text, p_content text)
returns void language plpgsql security definer as $$
begin
    insert into public.message_client_replies (message_id, content)
    values (p_message_id, p_content);
    update public.messages set status = 'open' where id = p_message_id;
end;
$$;

create or replace function public.admin_reply_message(p_message_id text, p_content text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.message_replies (message_id, content)
    values (p_message_id, p_content);
    update public.messages set status = 'replied' where id = p_message_id;
end;
$$;

create or replace function public.admin_resolve_message(p_message_id text, p_content text default null)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    if p_content is not null and trim(p_content) <> '' then
        insert into public.message_replies (message_id, content) values (p_message_id, p_content);
    end if;
    update public.messages set status = 'resolved' where id = p_message_id;
end;
$$;

create or replace function public.admin_delete_message(p_message_id text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    delete from public.messages where id = p_message_id;
end;
$$;

create or replace function public.admin_start_conversation(p_user_id uuid, p_subject text, p_content text)
returns public.messages language plpgsql security definer as $$
declare
    v_msg public.messages;
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.messages (user_id, subject, content, status)
    values (p_user_id, p_subject, p_content, 'replied')
    returning * into v_msg;
    return v_msg;
end;
$$;

-- حظر وفك حظر العملاء
create or replace function public.admin_set_block_status(p_user_id uuid, p_blocked boolean)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.profiles set is_blocked = p_blocked where id = p_user_id;
end;
$$;

create or replace function public.admin_delete_customer(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    delete from public.profiles where id = p_user_id;
end;
$$;

-- إدارة الأسئلة الشائعة
create or replace function public.admin_add_faq(p_question text, p_keywords text, p_answer text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.faqs (question, keywords, answer) values (p_question, p_keywords, p_answer);
end;
$$;

create or replace function public.admin_update_faq(p_id uuid, p_question text, p_keywords text, p_answer text)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.faqs set question = p_question, keywords = p_keywords, answer = p_answer where id = p_id;
end;
$$;

create or replace function public.admin_delete_faq(p_id uuid)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    delete from public.faqs where id = p_id;
end;
$$;

-- التحقق من وتوليد كود الخصم
create or replace function public.validate_discount_code(p_code text, p_service_id text default null)
returns numeric language plpgsql security definer as $$
declare
    v_pct numeric;
    v_keys text[];
begin
    select percentage, service_keys into v_pct, v_keys
    from public.discount_codes
    where code = upper(trim(p_code)) and is_active = true and (expires_at is null or expires_at > now())
    limit 1;

    if v_pct is null then return 0; end if;
    if v_keys is not null and array_length(v_keys, 1) > 0 and p_service_id is not null then
        if not (p_service_id = any(v_keys)) then return 0; end if;
    end if;

    return v_pct;
end;
$$;

create or replace function public.admin_generate_discount_code(p_percentage numeric, p_service_keys text[], p_expires_at timestamptz default null)
returns public.discount_codes language plpgsql security definer as $$
declare
    v_code text := 'DISC-' || upper(substring(md5(random()::text) from 1 for 6));
    v_res public.discount_codes;
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.discount_codes (code, percentage, service_keys, expires_at, is_active)
    values (v_code, p_percentage, p_service_keys, p_expires_at, true)
    returning * into v_res;
    return v_res;
end;
$$;

create or replace function public.admin_cancel_discount_code(p_id uuid)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    update public.discount_codes set is_active = false where id = p_id;
end;
$$;

create or replace function public.admin_delete_discount_code(p_id uuid)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    delete from public.discount_codes where id = p_id;
end;
$$;

-- العملات ونقاط الخدمة
create or replace function public.admin_set_currency_rate(p_currency text, p_rate numeric)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.currency_rates (currency_code, rate_per_egp) values (upper(p_currency), p_rate)
    on conflict (currency_code) do update set rate_per_egp = excluded.rate_per_egp;
end;
$$;

create or replace function public.admin_save_service_cost(p_key text, p_cost numeric)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.service_costs (service_key, cost) values (p_key, p_cost)
    on conflict (service_key) do update set cost = excluded.cost;
end;
$$;

create or replace function public.admin_save_service_points(p_key text, p_points integer)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.service_points (service_key, points_value) values (p_key, p_points)
    on conflict (service_key) do update set points_value = excluded.points_value;
end;
$$;

create or replace function public.admin_set_point_value(p_value numeric)
returns void language plpgsql security definer as $$
begin
    if not public.is_admin() then raise exception 'غير مصرح'; end if;
    insert into public.app_settings (key, value, description) values ('point_value_egp', p_value::text, 'قيمة النقطة بالجنيه المصري')
    on conflict (key) do update set value = excluded.value;
end;
$$;

-- حضور المستخدمين (Heartbeat Presence)
create or replace function public.heartbeat_presence(p_session_id text)
returns void language plpgsql security definer as $$
begin
    insert into public.online_sessions (session_id, last_seen)
    values (p_session_id, now())
    on conflict (session_id) do update set last_seen = now();
end;
$$;

create or replace function public.get_online_users_count()
returns integer language sql security definer as $$
    select count(*)::int from public.online_sessions where last_seen > now() - interval '2 minutes';
$$;

-- إحصائيات ولوحة الشرف
create or replace function public.get_completed_today_count()
returns integer language sql security definer as $$
    select count(*)::int from public.orders where status = 'completed' and created_at >= date_trunc('day', now());
$$;

create or replace function public.get_total_orders_count()
returns integer language sql security definer as $$
    select count(*)::int from public.orders;
$$;

create or replace function public.get_total_customers_count()
returns integer language sql security definer as $$
    select count(*)::int from public.profiles;
$$;

create or replace function public.get_spending_leaderboard()
returns table(user_name text, avatar_url text, total_spent numeric) language sql security definer as $$
    select p.name, p.avatar_url, coalesce(sum(o.total_price), 0) as total_spent
    from public.profiles p
    join public.orders o on o.user_id = p.id
    where o.status in ('completed', 'processing')
    group by p.id, p.name, p.avatar_url
    order by total_spent desc
    limit 10;
$$;

create or replace function public.get_referral_leaderboard()
returns table(user_name text, avatar_url text, friends_count bigint) language sql security definer as $$
    select p.name, p.avatar_url, count(f.id) as friends_count
    from public.profiles p
    join public.profiles f on f.referred_by = p.id
    group by p.id, p.name, p.avatar_url
    order by friends_count desc
    limit 10;
$$;

-- دوال برنامج الإحالة للمستخدم
create or replace function public.get_my_referral_stats()
returns json language plpgsql security definer as $$
declare
    v_total_friends bigint := 0;
    v_total_earnings numeric := 0;
begin
    select count(*) into v_total_friends from public.profiles where referred_by = auth.uid();
    select coalesce(sum(amount), 0) into v_total_earnings from public.referral_earnings where referrer_id = auth.uid();
    return json_build_object(
        'total_friends', v_total_friends,
        'total_earnings', v_total_earnings
    );
end;
$$;

create or replace function public.get_my_referral_friends()
returns table(name text, created_at timestamptz, has_orders boolean) language sql security definer as $$
    select p.name, p.created_at, exists(select 1 from public.orders o where o.user_id = p.id) as has_orders
    from public.profiles p
    where p.referred_by = auth.uid()
    order by p.created_at desc;
$$;

create or replace function public.get_my_referral_earnings()
returns table(amount numeric, created_at timestamptz, source_order_id text) language sql security definer as $$
    select amount, created_at, source_order_id
    from public.referral_earnings
    where referrer_id = auth.uid()
    order by created_at desc;
$$;

-- نقاط مشاهدة الإعلانات اليومية
create or replace function public.claim_ad_points()
returns integer language plpgsql security definer as $$
declare
    v_current_points int;
begin
    update public.profiles set points = points + 10 where id = auth.uid() returning points into v_current_points;
    return v_current_points;
end;
$$;

-- ترقية أي مستخدم إلى أدمن بواسطة رقم التليفون
create or replace function public.promote_user_to_admin(p_phone text)
returns text language plpgsql security definer as $$
declare
    v_user_name text;
begin
    update public.profiles set role = 'admin' where phone = p_phone returning name into v_user_name;
    if v_user_name is null then
        return 'لم يتم العثور على مستخدم بهذا الرقم: ' || p_phone;
    else
        return 'تمت ترقية الحساب بنجاح إلى مسؤول: ' || v_user_name;
    end if;
end;
$$;

-- ==============================================================================
-- 14. إعدادات افتراضية أولية (Default Seeds)
-- ==============================================================================
insert into public.app_settings (key, value, description)
values ('point_value_egp', '0.05', 'قيمة النقطة بالجنيه المصري')
on conflict (key) do nothing;

insert into public.currency_rates (currency_code, rate_per_egp) values
('EGP', 1.0000),
('USD', 0.0200),
('SAR', 0.0750),
('AED', 0.0730),
('KWD', 0.0061)
on conflict (currency_code) do nothing;

insert into public.referral_tier_config (min_activated_friends, rate_percent) values
(0, 5.0),
(10, 7.5),
(25, 10.0),
(50, 15.0)
on conflict (min_activated_friends) do nothing;

insert into public.faqs (question, keywords, answer) values
('كيف يمكنني شحن رصيدي؟', 'شحن, رصيد, فودافون, تيلدا, دفع', 'يمكنك الذهاب لصفحة "شحن الرصيد"، واختيار طريقة الدفع المناسبة لك (فودافون كاش أو تيلدا)، وتحويل المبلغ إلى الرقم الموضح، ثم إدخال رقم المعاملة وصورة إيصال التحويل.'),
('كم يستغرق تنفيذ الطلب؟', 'تنفيذ, وقت, سرعة, طلب', 'يبدأ تنفيذ معظم الخدمات بشكل فوري وتلقائي أو خلال دقائق معدودة من تأكيد الطلب، وقد يستغرق استكمال الأعداد الكبيرة وقتاً إضافياً لضمان سلامة حسابك.'),
('هل خدماتكم آمنة على حساباتي؟', 'أمان, حظر, تيك توك, حساب', 'نعم بنسبة 100%، جميع خدماتنا تطابق سياسات منصات التواصل الاجتماعي ولا نطلب منك مطلقاً أي كلمات مرور، كل ما نحتاجه هو رابط الفيديو أو الحساب العام فقط.')
on conflict do nothing;

-- ==============================================================================
-- 15. إعداد Storage Buckets للصور والإيصالات
-- ==============================================================================
insert into storage.buckets (id, name, public) values
('avatars', 'avatars', true),
('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

-- سياسات التخزين للصور
drop policy if exists "Public Access for avatars" on storage.objects;
create policy "Public Access for avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Auth upload avatar" on storage.objects;
create policy "Auth upload avatar" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() is not null);

drop policy if exists "Auth update avatar" on storage.objects;
create policy "Auth update avatar" on storage.objects for update using (bucket_id = 'avatars' and auth.uid() is not null);

-- سياسات إيصالات الدفع
drop policy if exists "Public Access for proofs" on storage.objects;
create policy "Public Access for proofs" on storage.objects for select using (bucket_id = 'payment-proofs');

drop policy if exists "Auth upload proofs" on storage.objects;
create policy "Auth upload proofs" on storage.objects for insert with check (bucket_id = 'payment-proofs' and auth.uid() is not null);
