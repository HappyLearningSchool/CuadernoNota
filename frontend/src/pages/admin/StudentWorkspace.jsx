import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bulkAnnulEnrollments, bulkWithdrawStudents, getAdminStudents, getStudentWorkspaces } from '../../api/admin.api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';
import useToast from '../../hooks/useToast';
import PageHeader from '../../components/ui/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import SearchInput from '../../components/ui/SearchInput';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentActions from '../../components/admin/StudentActions';
import StudentBulkDelete from '../../components/admin/StudentBulkDelete';
import StudentBulkReplaceDrawer from '../../components/admin/StudentBulkReplaceDrawer';
import FormField, { inputClass, selectClass } from '../../components/ui/FormField';
import Toast from '../../components/ui/Toast';

export default function StudentWorkspace() {
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const yearId = searchParams.get('year') || '';
  const pending = workspaceId === 'pending';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast, showToast } = useToast();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const selectedIds = selectedStudents.map((student) => Number(student.id));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [withdrawStudents, setWithdrawStudents] = useState([]);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [annulStudents, setAnnulStudents] = useState([]);
  const [annulReason, setAnnulReason] = useState('');
  const annul = useMutation({
    mutationFn: bulkAnnulEnrollments,
    onSuccess: (result) => {
      setAnnulStudents([]);
      setSelectedStudents([]);
      qc.invalidateQueries({ queryKey: ['admin-student'] });
      qc.invalidateQueries({ queryKey: ['admin-student-placements'] });
      showToast(result.message);
    },
  });
  const withdraw = useMutation({
    mutationFn: bulkWithdrawStudents,
    onSuccess: (result) => {
      setWithdrawStudents([]);
      setSelectedStudents([]);
      qc.invalidateQueries({ predicate: (query) => [
        'admin-students', 'admin-student', 'admin-student-placements', 'admin-dashboard',
        'admin-sections', 'admin-promotion-candidates', 'admin-student-workspaces', 'courses', 'attendance',
      ].includes(query.queryKey[0]) });
      showToast(result.message);
    },
  });

  useEffect(() => {
    setSelectedStudents([]);
    setBulkOpen(false);
    setWithdrawStudents([]);
    setAnnulStudents([]);
    annul.reset();
  }, [workspaceId, yearId]);

  const workspaceParams = yearId ? { academic_year_id: yearId } : {};
  const { data: workspaceData } = useQuery({
    queryKey: ['admin-student-workspaces', workspaceParams],
    queryFn: () => getStudentWorkspaces(workspaceParams),
  });
  const workspace = pending
    ? null
    : workspaceData?.workspaces?.find((item) => Number(item.id) === Number(workspaceId));
  const params = {
    per_page: 1000,
    ...(pending ? { pending: 1 } : { section_id: workspaceId, ...(yearId ? { academic_year_id: yearId } : {}) }),
    ...(search ? { search } : {}),
    ...(active !== '' ? { active } : {}),
  };
  const { data, isLoading } = useQuery({
    queryKey: ['admin-students', 'workspace', params],
    queryFn: () => getAdminStudents(params),
  });
  const students = data?.data || [];

  const visibleSelectedCount = students.filter((student) => selectedIds.includes(Number(student.id))).length;
  const allVisibleSelected = students.length > 0 && visibleSelectedCount === students.length;
  const title = pending
    ? 'Pendientes de asignación'
    : workspace ? `${workspace.grade_name} · Sección ${workspace.section_name}` : 'Workspace del curso';
  const description = pending
    ? 'Expedientes sin una sección actual. Revisa, corrige y prepara a los estudiantes para su asignación.'
    : workspace ? `${workspace.shift} · ${workspace.academic_year_name} · Administra a todos los estudiantes de este curso.` : 'Cargando información del curso…';
  const totals = pending ? workspaceData?.pending : workspace;
  const workspaceLabel = pending ? 'Pendientes de asignación' : title;

  const updateSelection = (rows, checked) => {
    const ids = new Set(rows.map((student) => Number(student.id)));
    setSelectedStudents((current) => {
      const remaining = current.filter((student) => !ids.has(Number(student.id)));
      return checked ? [...remaining, ...rows] : remaining;
    });
  };

  return <>
    <PageHeader
      breadcrumb={['Portal Administrativo', { label: 'Estudiantes', to: '/admin/students' }, title]}
      title={title}
      description={description}
      actions={<button type="button" onClick={() => navigate('/admin/student-placements')} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">group_add</span> Asignar estudiantes
      </button>}
    />

    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Estudiantes" value={totals?.students_count ?? data?.total ?? 0} icon="groups" />
      <Kpi label="Activos" value={totals?.active_students_count ?? students.filter((student) => student.active).length} icon="person_check" tone="emerald" />
      <Kpi label="Inactivos" value={totals?.inactive_students_count ?? students.filter((student) => !student.active).length} icon="person_off" tone="slate" />
      <Kpi label="Seleccionados" value={selectedIds.length} icon="select_check_box" tone="indigo" />
    </section>

    <FilterBar>
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o matrícula..." className="max-w-sm" />
      <select aria-label="Filtrar por estado" value={active} onChange={(event) => setActive(event.target.value)} className={`${selectClass} w-auto`}>
        <option value="">Todos los estados</option>
        <option value="1">Activos</option>
        <option value="0">Inactivos</option>
      </select>
    </FilterBar>

    {(students.length > 0 || selectedIds.length > 0) && <div className="sticky top-0 z-20 mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-extrabold text-slate-900">Acciones por lote</p>
        <p className="mt-1 text-xs text-slate-500">{selectedIds.length} seleccionados en total · {visibleSelectedCount} visibles.</p>
        {!pending && selectedIds.length > 0 && <p className="mt-1 text-xs font-bold text-indigo-600">Usa «Quitar seleccionados del curso» para retirar todo el grupo marcado.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <StudentBulkDelete students={selectedStudents} onDeleted={(result) => { setSelectedStudents([]); showToast(result.message); }} />
        {pending && <button type="button" disabled={!selectedStudents.length} onClick={() => {
          annul.reset();
          setAnnulReason('');
          setAnnulStudents(selectedStudents);
        }} className="rounded-lg border border-red-200 px-3 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-40">
          Anular matrículas
        </button>}
        {!pending && <button type="button" disabled={!selectedIds.length} onClick={() => { withdraw.reset(); setWithdrawReason(''); setWithdrawStudents(selectedStudents); }} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40">
          <span aria-hidden="true" className="material-symbols-outlined text-[17px]">group_remove</span> Quitar seleccionados del curso ({selectedIds.length})
        </button>}
        <button type="button" disabled={!students.length} onClick={() => updateSelection(students, !allVisibleSelected)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">{allVisibleSelected ? 'Desmarcar visibles' : 'Seleccionar visibles'}</button>
        {selectedIds.length > 0 && <button type="button" onClick={() => setSelectedStudents([])} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Limpiar selección</button>}
        <button type="button" disabled={!selectedIds.length} onClick={() => setBulkOpen(true)} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40">
          <span aria-hidden="true" className="material-symbols-outlined text-[17px]">find_replace</span> Buscar y reemplazar matrículas
        </button>
      </div>
    </div>}

    <DataTable
      loading={isLoading}
      rows={students}
      onRowClick={(student) => navigate(`/admin/students/${student.id}`)}
      emptyIcon="groups"
      emptyTitle="No hay estudiantes que coincidan con los filtros de este workspace."
      columns={[
        { key: 'select', label: '', align: 'center', render: (student) => <input aria-label={`Seleccionar a ${student.name} ${student.last_name}`} type="checkbox" checked={selectedIds.includes(Number(student.id))} onClick={(event) => event.stopPropagation()} onChange={(event) => updateSelection([student], event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" /> },
        { key: 'enrollment_no', label: 'Matrícula', render: (student) => <span className="font-mono text-xs font-bold text-slate-500">{student.enrollment_no}</span> },
        { key: 'student', label: 'Estudiante', render: (student) => <div><p className="font-extrabold text-slate-900">{student.name} {student.last_name}</p><p className="mt-1 text-xs text-slate-500">{student.section ? `${student.section.grade?.name} · Sección ${student.section.name}` : 'Sin sección actual'}</p></div> },
        { key: 'year', label: 'Año escolar', render: (student) => student.section?.academic_year?.name || '—' },
        { key: 'active', label: 'Estado', align: 'center', render: (student) => <StatusBadge tone={!student.active ? 'neutral' : student.section ? 'success' : 'warning'} label={!student.active ? 'Inactivo' : student.section ? 'Inscrito' : 'Pendiente'} /> },
        { key: 'actions', label: 'Acciones', align: 'right', render: (student) => <StudentActions student={student} hideWithdraw={selectedIds.length > 0} onDeleted={() => updateSelection([student], false)} onSuccess={showToast} /> },
      ]}
    />

    <StudentBulkReplaceDrawer
      open={bulkOpen}
      onClose={() => setBulkOpen(false)}
      students={selectedStudents}
      workspaceLabel={workspaceLabel}
      onApplied={(result) => {
        qc.invalidateQueries({ queryKey: ['admin-students'] });
        qc.invalidateQueries({ queryKey: ['admin-student-workspaces'] });
        setBulkOpen(false);
        setSelectedStudents([]);
        showToast(result.message);
      }}
    />
    <ConfirmDialog open={withdrawStudents.length > 0} onClose={() => { if (!withdraw.isPending) setWithdrawStudents([]); }}
      title={`Quitar ${withdrawStudents.length} estudiantes del curso`}
      message={`Se retirarán de ${title}. Sus notas, asistencia e historial se conservarán. Los estudiantes activos quedarán pendientes de asignación.`}
      confirmLabel="Quitar seleccionados" loading={withdraw.isPending} disableConfirm={!withdrawReason.trim()}
      onConfirm={() => withdraw.mutate({ student_ids: withdrawStudents.map((student) => Number(student.id)), section_id: Number(workspaceId), reason: withdrawReason.trim() })}>
      <ul className="mb-3 max-h-32 overflow-y-auto text-xs text-slate-600">
        {withdrawStudents.map((student) => <li key={student.id}>{student.enrollment_no} · {student.name} {student.last_name}</li>)}
      </ul>
      {withdraw.isError && <p role="alert" className="mb-3 text-sm text-red-600">{getErrorMessage(withdraw.error)}</p>}
      <FormField htmlFor="bulk-withdraw-reason" label="Motivo del retiro" required>
        <textarea id="bulk-withdraw-reason" autoFocus rows={3} maxLength={200} disabled={withdraw.isPending} className={inputClass} value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} />
      </FormField>
    </ConfirmDialog>
    {annul.isSuccess && annul.data.skipped.length > 0 && <section role="status" className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
      <p className="font-bold">{annul.data.message}</p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {annul.data.skipped.map(({ enrollment_no, reason }) => <li key={enrollment_no}>{enrollment_no} · {reason}</li>)}
      </ul>
    </section>}
    <ConfirmDialog open={annulStudents.length > 0} onClose={() => { if (!annul.isPending) setAnnulStudents([]); }}
      title={`Anular matrículas de ${annulStudents.length} estudiantes`}
      message="Se anulará la matrícula de cada expediente sin sección actual que tenga una sola matrícula anterior y esté libre de otros registros académicos. El resultado indicará qué expedientes se omitieron."
      confirmLabel="Anular matrículas" tone="danger" loading={annul.isPending} disableConfirm={!annulReason.trim()}
      onConfirm={() => annul.mutate({ student_ids: annulStudents.map((student) => Number(student.id)), reason: annulReason.trim() })}>
      <ul className="mb-3 max-h-32 overflow-y-auto text-xs text-slate-600">
        {annulStudents.map((student) => <li key={student.id}>{student.enrollment_no} · {student.name} {student.last_name}</li>)}
      </ul>
      {annul.isError && <p role="alert" className="mb-3 text-sm text-red-600">{getErrorMessage(annul.error)}</p>}
      <FormField htmlFor="bulk-annul-reason" label="Motivo de la anulación" required>
        <textarea id="bulk-annul-reason" autoFocus rows={3} maxLength={200} disabled={annul.isPending} className={inputClass} value={annulReason} onChange={(event) => setAnnulReason(event.target.value)} />
      </FormField>
    </ConfirmDialog>
    <Toast toast={toast} />
  </>;
}

function Kpi({ label, value, icon, tone = 'slate' }) {
  const colors = { slate: 'text-slate-950', emerald: 'text-emerald-600', indigo: 'text-indigo-600' };
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-2xl font-extrabold ${colors[tone]}`}>{value}</p></div><span aria-hidden="true" className="material-symbols-outlined relative top-[2px] text-slate-400">{icon}</span></div></div>;
}
