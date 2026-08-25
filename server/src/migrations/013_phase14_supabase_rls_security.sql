-- ==============================================================================
-- SheDrive Phase 14: Supabase Row-Level Security (RLS) Hardening Migration
-- Migration: 013_phase14_supabase_rls_security.sql
-- Description: Enables RLS across all application tables while guaranteeing that
--              backend TCP connection pool and service_role retain full access.
-- ==============================================================================

-- 1. Enable Row Level Security on all core tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ride_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Grant unrestricted bypass to backend service_role and postgres superuser
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
              'users', 'drivers', 'rides', 'ride_stops', 'payment_transactions',
              'monthly_payments', 'sos_alerts', 'support_tickets', 'feedbacks',
              'saved_places', 'user_notifications', 'emergency_contacts',
              'admin_settings', 'audit_logs'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS service_role_all ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl);

        EXECUTE format('DROP POLICY IF EXISTS postgres_all ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY postgres_all ON public.%I FOR ALL TO postgres USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- 3. Fine-grained user ownership policies for authenticated client access

-- Users Table
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users 
    FOR SELECT TO authenticated 
    USING (id = auth.uid()::text);

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users 
    FOR UPDATE TO authenticated 
    USING (id = auth.uid()::text) 
    WITH CHECK (id = auth.uid()::text);

-- Drivers Table
DROP POLICY IF EXISTS drivers_select_own ON public.drivers;
CREATE POLICY drivers_select_own ON public.drivers 
    FOR SELECT TO authenticated 
    USING (driver_id = auth.uid()::text);

-- Rides Table
DROP POLICY IF EXISTS rides_select_participant ON public.rides;
CREATE POLICY rides_select_participant ON public.rides 
    FOR SELECT TO authenticated 
    USING (passenger_id = auth.uid()::text OR driver_id = auth.uid()::text);

-- Ride Stops Table
DROP POLICY IF EXISTS ride_stops_select_participant ON public.ride_stops;
CREATE POLICY ride_stops_select_participant ON public.ride_stops 
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.rides r 
            WHERE r.ride_id = ride_stops.ride_id 
              AND (r.passenger_id = auth.uid()::text OR r.driver_id = auth.uid()::text)
        )
    );

-- Saved Places Table
DROP POLICY IF EXISTS saved_places_owner ON public.saved_places;
CREATE POLICY saved_places_owner ON public.saved_places 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid()::text) 
    WITH CHECK (user_id = auth.uid()::text);

-- User Notifications Table
DROP POLICY IF EXISTS user_notifications_owner ON public.user_notifications;
CREATE POLICY user_notifications_owner ON public.user_notifications 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid()::text) 
    WITH CHECK (user_id = auth.uid()::text);

-- Emergency Contacts Table
DROP POLICY IF EXISTS emergency_contacts_owner ON public.emergency_contacts;
CREATE POLICY emergency_contacts_owner ON public.emergency_contacts 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid()::text) 
    WITH CHECK (user_id = auth.uid()::text);

-- Payment Transactions Table
DROP POLICY IF EXISTS payment_transactions_owner ON public.payment_transactions;
CREATE POLICY payment_transactions_owner ON public.payment_transactions 
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid()::text);

-- Support Tickets Table
DROP POLICY IF EXISTS support_tickets_owner ON public.support_tickets;
CREATE POLICY support_tickets_owner ON public.support_tickets 
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert ON public.support_tickets 
    FOR INSERT TO authenticated 
    WITH CHECK (user_id = auth.uid()::text);

-- Feedbacks Table (Allow public insert)
DROP POLICY IF EXISTS feedbacks_insert_all ON public.feedbacks;
CREATE POLICY feedbacks_insert_all ON public.feedbacks 
    FOR INSERT TO anon, authenticated 
    WITH CHECK (true);

-- Admin Settings Table (Read-only for app clients)
DROP POLICY IF EXISTS admin_settings_select_all ON public.admin_settings;
CREATE POLICY admin_settings_select_all ON public.admin_settings 
    FOR SELECT TO anon, authenticated 
    USING (true);

-- End of Phase 14 RLS Migration
