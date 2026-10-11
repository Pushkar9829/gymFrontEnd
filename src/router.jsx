import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import AdminLayout from './layouts/AdminLayout';
import PortalLayout from './layouts/PortalLayout';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import { PageLoader } from './components/ui';

// Route-level code splitting keeps the member portal light on phones.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MembersList = lazy(() => import('./pages/members/MembersList'));
const MemberDetail = lazy(() => import('./pages/members/MemberDetail'));
const CheckIn = lazy(() => import('./pages/CheckIn'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Payments = lazy(() => import('./pages/Payments'));
const Plans = lazy(() => import('./pages/Plans'));
const Leads = lazy(() => import('./pages/Leads'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Reports = lazy(() => import('./pages/Reports'));
const Devices = lazy(() => import('./pages/Devices'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Messages = lazy(() => import('./pages/Messages'));
const PersonalTraining = lazy(() => import('./pages/PersonalTraining'));
const FitnessLibrary = lazy(() => import('./pages/fitness/FitnessLibrary'));
const PortalFitness = lazy(() => import('./pages/portal/PortalFitness'));
const Classes = lazy(() => import('./pages/Classes'));
const Join = lazy(() => import('./pages/Join'));
const PortalClasses = lazy(() => import('./pages/portal/PortalClasses'));
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'));
const PortalHome = lazy(() => import('./pages/portal/PortalHome'));
const PortalHistory = lazy(() => import('./pages/portal/PortalHistory'));
const PortalRenew = lazy(() => import('./pages/portal/PortalRenew'));

const s = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/join', element: s(<Join />) },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: s(<Dashboard />) },
      { path: 'check-in', element: s(<CheckIn />) },
      { path: 'members', element: s(<MembersList />) },
      { path: 'members/:id', element: s(<MemberDetail />) },
      { path: 'attendance', element: s(<Attendance />) },
      { path: 'payments', element: s(<Payments />) },
      { path: 'plans', element: s(<Plans />) },
      { path: 'leads', element: s(<Leads />) },
      { path: 'expenses', element: s(<Expenses />) },
      { path: 'reports', element: s(<Reports />) },
      { path: 'devices', element: s(<Devices />) },
      { path: 'settings', element: s(<Settings />) },
      { path: 'messages', element: s(<Messages />) },
      { path: 'pt', element: s(<PersonalTraining />) },
      { path: 'fitness', element: s(<FitnessLibrary />) },
      { path: 'classes', element: s(<Classes />) },
    ],
  },
  { path: '/portal/login', element: s(<PortalLogin />) },
  {
    path: '/portal',
    element: <PortalLayout />,
    children: [
      { index: true, element: s(<PortalHome />) },
      { path: 'history', element: s(<PortalHistory />) },
      { path: 'renew', element: s(<PortalRenew />) },
      { path: 'fitness', element: s(<PortalFitness />) },
      { path: 'classes', element: s(<PortalClasses />) },
    ],
  },
  { path: '*', element: <Navigate to="/admin" replace /> },
]);
