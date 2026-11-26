import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminStudents, getAdminUsers, getSections } from '../../api/admin.api';

const panel = 'absolute top-full z-30 mt-2 max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg';
const resultLink = 'block rounded-lg px-3 py-2 text-sm hover:bg-indigo-50 focus-visible:bg-indigo-50';

export function AdminGlobalSearch({ year }) {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const input = search.trim();

  useEffect(() => setOpen(false), [location.key]);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(input), 250);
    return () => clearTimeout(timer);
  }, [input]);

  const enabled = open && input.length >= 2 && input === term;
  const students = useQuery({
    queryKey: ['admin-students', 'global-search', term],
    queryFn: () => getAdminStudents({ search: term, per_page: 5 }),
    enabled,
  });
  const users = useQuery({
    queryKey: ['admin-users', 'global-search', term],
    queryFn: () => getAdminUsers({ search: term, per_page: 5 }),
    enabled,
  });
  const sections = useQuery({
    queryKey: ['admin-sections', 'global-search', year?.id],
    queryFn: () => getSections(year ? { academic_year_id: year.id } : {}),
    enabled,
  });

  const groups = [
    { label: 'Estudiantes', rows: (students.data?.data ?? []).map((student) => ({
      to: `/admin/students/${student.id}`, title: `${student.name} ${student.last_name}`, detail: student.enrollment_no,
    })) },
    { label: 'Usuarios', rows: (users.data?.data ?? []).map((user) => ({
      to: `/admin/users?${new URLSearchParams({ search: user.email })}`, title: user.name, detail: user.email,
    })) },
    { label: 'Cursos', rows: (Array.isArray(sections.data) ? sections.data : sections.data?.data ?? [])
      .filter((section) => `${section.grade?.name ?? ''} ${section.name}`.toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es')))
      .slice(0, 5).map((section) => ({
        to: `/admin/students/workspaces/${section.id}?year=${section.academic_year_id}`,
        title: `${section.grade?.name ?? ''} ${section.name}`, detail: section.academic_year?.name,
      })) },
  ];
  const busy = input !== term || [students, users, sections].some((query) => query.isFetching);
  const failed = [students, users, sections].some((query) => query.isError);

  return <div className="relative w-full max-w-md min-w-0" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === 'Escape') setOpen(false);
  }}>
    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" aria-hidden="true">search</span>
    <input type="search" aria-label="Búsqueda global" aria-controls="admin-global-results" placeholder="Buscar estudiantes, usuarios o cursos…"
      value={search} onFocus={() => setOpen(true)} onChange={(event) => { setSearch(event.target.value); setOpen(true); }}
      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
    <div id="admin-global-results" hidden={!open || input.length < 2} className={`${panel} left-0 w-full min-w-48`}>
      {busy ? <p role="status" className="p-3 text-sm text-slate-500">Buscando…</p> : <>
        {groups.filter(({ rows }) => rows.length).map(({ label, rows }) => <section key={label} aria-label={label}>
          <p className="px-3 pt-2 text-xs font-bold text-slate-500">{label}</p>
          {rows.map(({ to, title, detail }) => <Link key={to} to={to} className={resultLink} onClick={() => { setOpen(false); setSearch(''); }}>
            <span className="block font-semibold text-slate-900">{title}</span>
            <span className="block break-all text-xs text-slate-500">{detail}</span>
          </Link>)}
        </section>)}
        {failed && <p role="status" className="p-3 text-sm text-slate-500">Algunos resultados no están disponibles.</p>}
        {!failed && groups.every(({ rows }) => !rows.length) && <p role="status" className="p-3 text-sm text-slate-500">Sin resultados.</p>}
      </>}
    </div>
  </div>;
}

export function AdminNotifications({ dashboard }) {
  const location = useLocation();
  const reviews = dashboard?.pending_grades ?? 0;
  const alerts = dashboard?.unresolved_alerts ?? 0;
  const total = reviews + alerts;

  return <details key={location.key} className="relative">
    <summary aria-label={`Notificaciones (${total})`} className="relative flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 [&::-webkit-details-marker]:hidden">
      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">notifications</span>
      {total > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">{total > 99 ? '99+' : total}</span>}
    </summary>
    <section className={`${panel} right-0 w-64`} aria-label="Notificaciones administrativas">
      <h2 className="px-3 py-2 text-sm font-bold text-slate-900">Notificaciones</h2>
      {!dashboard && <p className="px-3 py-2 text-sm text-slate-500">Datos de notificaciones no disponibles.</p>}
      {dashboard && total === 0 && <p className="px-3 py-2 text-sm text-slate-500">No hay pendientes.</p>}
      {reviews > 0 && <Link className={resultLink} to="/admin/reviews" onClick={(event) => { event.currentTarget.closest('details').open = false; }}>{reviews} calificaciones por revisar</Link>}
      {alerts > 0 && <Link className={resultLink} to="/admin/dashboard" onClick={(event) => { event.currentTarget.closest('details').open = false; }}>{alerts} alertas activas</Link>}
    </section>
  </details>;
}
