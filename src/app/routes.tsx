import { createBrowserRouter, Navigate } from "react-router";
import AdminGate from "./components/AdminGate";
import CreateBranch from "./pages/CreateBranch";
import StaffList from "./pages/StaffList";
import StaffDetail from "./pages/StaffDetail";
import ServicesList from "./pages/ServicesList";
import ServiceAddOnsList from "./pages/ServiceAddOnsList";
import ServicesBranchPage from "./pages/ServicesBranchPage";
import AddonsBranchPage from "./pages/AddonsBranchPage";
import PromotionsList from "./pages/PromotionsList";
import PromotionsDetail from "./pages/PromotionsDetail";
import DayTimePricingList from "./pages/DayTimePricingList";
import DayTimePricingDetail from "./pages/DayTimePricingDetail";
import FreeCoffeeList from "./pages/FreeCoffeeList";
import FreeCoffeeDetail from "./pages/FreeCoffeeDetail";
import LoyaltyConfigList from "./pages/LoyaltyConfigList";
import LoyaltyConfigBranchPage from "./pages/LoyaltyConfigBranchPage";
import MobileServicesServicesPage from "./pages/MobileServicesServicesPage";
import MobileServicesAddonsPage from "./pages/MobileServicesAddonsPage";
import MobileServicesPromoCodesPage from "./pages/MobileServicesPromoCodesPage";
import MobileServicesDayTimePage from "./pages/MobileServicesDayTimePage";
import MobileServicesTeamPage from "./pages/MobileServicesTeamPage";
import MobileServicesLoyaltyPage from "./pages/MobileServicesLoyaltyPage";
import ServiceHistoryPage from "./pages/ServiceHistoryPage";
import ReportsPage from "./pages/ReportsPage";
import ReportDetailPage from "./pages/ReportDetailPage";
import RevenueSummaryPage from "./pages/RevenueSummaryPage";
import LoginPage from "./pages/LoginPage";
import ManagerLoginPage from "./pages/manager/ManagerLoginPage";
import ManagerLayout from "./components/manager/ManagerLayout";
import ManagerIndexRedirect from "./pages/manager/ManagerIndexRedirect";
import ConfigureSlotsPage from "./pages/manager/ConfigureSlotsPage";
import CreateBookingPage from "./pages/manager/CreateBookingPage";
import ViewBookingsPage from "./pages/manager/ViewBookingsPage";
import MobileCreateSlotsPage from "./pages/manager/mobile/MobileCreateSlotsPage";
import MobileConfigureSlotsPage from "./pages/manager/mobile/MobileConfigureSlotsPage";
import MobileCreateBookingPage from "./pages/manager/mobile/MobileCreateBookingPage";
import MobileViewBookingsPage from "./pages/manager/mobile/MobileViewBookingsPage";
import MobileDriversPage from "./pages/manager/mobile/MobileDriversPage";
import MobileTasksPage from "./pages/manager/mobile/MobileTasksPage";
import WasherLoginPage from "./pages/washer/WasherLoginPage";
import WasherLayout from "./components/washer/WasherLayout";
import WasherJobsPage from "./pages/washer/WasherJobsPage";
import WasherLeaveRequestsPage from "./pages/manager/WasherLeaveRequestsPage";
import WashersPage from "./pages/manager/WashersPage";
import MobileDriverLeaveRequestsPage from "./pages/manager/mobile/MobileDriverLeaveRequestsPage";
import CustomersPage from "./pages/CustomersPage";
import RevenueReportPage from "./pages/RevenueReportPage";
import BookingReportPage from "./pages/BookingReportPage";
import StaffJobReportPage from "./pages/StaffJobReportPage";
import SettingsPage from "./pages/SettingsPage";

export const router = createBrowserRouter([
  { path: "/login", Component: LoginPage },
  { path: "/manager/login", Component: ManagerLoginPage },
  { path: "/washer/login", Component: WasherLoginPage },
  {
    path: "/washer",
    Component: WasherLayout,
    children: [{ path: "jobs", Component: WasherJobsPage }],
  },
  {
    path: "/manager",
    Component: ManagerLayout,
    children: [
      { index: true, Component: ManagerIndexRedirect },
      { path: "configure-bay", Component: ConfigureSlotsPage },
      { path: "configure-slots", element: <Navigate to="/manager/configure-bay" replace /> },
      { path: "assign-jobs", element: <Navigate to="/manager/create-booking" replace /> },
      { path: "create-booking", Component: CreateBookingPage },
      { path: "view-bookings", Component: ViewBookingsPage },
      { path: "mobile/view-bookings", Component: MobileViewBookingsPage },
      { path: "mobile/create-booking", Component: MobileCreateBookingPage },
      { path: "mobile/configure-slots", Component: MobileConfigureSlotsPage },
      { path: "mobile/create-slots", Component: MobileCreateSlotsPage },
      { path: "mobile/drivers", Component: MobileDriversPage },
      { path: "mobile/tasks", Component: MobileTasksPage },
      { path: "mobile/leave-requests", Component: MobileDriverLeaveRequestsPage },
      { path: "leave-requests", Component: WasherLeaveRequestsPage },
      { path: "washers", Component: WashersPage },
    ],
  },
  {
    path: "/",
    Component: AdminGate,
    children: [
      { index: true, element: <Navigate to="/create-branch" replace /> },
      { path: "create-branch", Component: CreateBranch },
      { path: "staff", Component: StaffList },
      { path: "staff/:branchId", Component: StaffDetail },
      { path: "services", Component: ServicesList },
      { path: "service-addons", Component: ServiceAddOnsList },
      { path: "services/:branchId", Component: ServicesBranchPage },
      { path: "service-addons/:branchId", Component: AddonsBranchPage },
      { path: "promotions", Component: PromotionsList },
      { path: "promotions/:branchId", Component: PromotionsDetail },
      { path: "day-time-pricing", Component: DayTimePricingList },
      { path: "day-time-pricing/:branchId", Component: DayTimePricingDetail },
      { path: "free-coffee", Component: FreeCoffeeList },
      { path: "free-coffee/:branchId", Component: FreeCoffeeDetail },
      { path: "loyalty", Component: LoyaltyConfigList },
      { path: "loyalty/:branchId", Component: LoyaltyConfigBranchPage },
      { path: "mobile-services", element: <Navigate to="/mobile-services/services" replace /> },
      { path: "mobile-services/services", Component: MobileServicesServicesPage },
      { path: "mobile-services/add-ons", Component: MobileServicesAddonsPage },
      { path: "mobile-services/promo-codes", Component: MobileServicesPromoCodesPage },
      { path: "mobile-services/day-time-pricing", Component: MobileServicesDayTimePage },
      { path: "mobile-services/team", Component: MobileServicesTeamPage },
      { path: "mobile-services/loyalty", Component: MobileServicesLoyaltyPage },
      { path: "service-history", Component: ServiceHistoryPage },
      { path: "reports", Component: ReportsPage },
      { path: "reports/:reportType", Component: ReportDetailPage },
      { path: "revenue-summary", Component: RevenueSummaryPage },
      { path: "customers", Component: CustomersPage },
      { path: "revenue-report", Component: RevenueReportPage },
      { path: "booking-report", Component: BookingReportPage },
      { path: "staff-job-report", Component: StaffJobReportPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
