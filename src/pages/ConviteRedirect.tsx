import { Navigate, useParams } from "react-router-dom";

export default function ConviteRedirect() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <Navigate to="/login" replace />;
  return <Navigate to={`/convite/${code}`} replace />;
}
