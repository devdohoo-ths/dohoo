-- Criar tabela departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delivery_strategy TEXT DEFAULT 'round_robin' CHECK (delivery_strategy IN ('round_robin', 'priority', 'broadcast')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela department_members para relacionar usuários com departamentos
CREATE TABLE IF NOT EXISTS public.department_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('manager', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(department_id, user_id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON public.departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON public.departments(is_active);
CREATE INDEX IF NOT EXISTS idx_department_members_department_id ON public.department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_department_members_user_id ON public.department_members(user_id);

-- Habilitar RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para departments
DROP POLICY IF EXISTS "Users can view departments in their organization" ON public.departments;
DROP POLICY IF EXISTS "Users can create departments in their organization" ON public.departments;
DROP POLICY IF EXISTS "Users can update departments in their organization" ON public.departments;
DROP POLICY IF EXISTS "Users can delete departments in their organization" ON public.departments;

CREATE POLICY "Users can view departments in their organization" ON public.departments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create departments in their organization" ON public.departments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update departments in their organization" ON public.departments
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete departments in their organization" ON public.departments
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Políticas RLS para department_members
DROP POLICY IF EXISTS "Users can view department members in their organization" ON public.department_members;
DROP POLICY IF EXISTS "Users can manage department members in their organization" ON public.department_members;

CREATE POLICY "Users can view department members in their organization" ON public.department_members
  FOR SELECT USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      JOIN public.profiles p ON d.organization_id = p.organization_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage department members in their organization" ON public.department_members
  FOR ALL USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      JOIN public.profiles p ON d.organization_id = p.organization_id
      WHERE p.id = auth.uid()
    )
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at 
  BEFORE UPDATE ON public.departments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 