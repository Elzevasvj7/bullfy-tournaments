import { Navigate } from "react-router-dom";

// Legacy /zoom route — redirects to the new unified Bullfy Live entry point.
const Zoom = () => <Navigate to="/live" replace />;

export default Zoom;
