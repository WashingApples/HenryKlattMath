import { AcademicSite, pageInfo } from "../site";

export const metadata = { title: pageInfo.service.title, description: pageInfo.service.description };

export default function Page() {
  return <AcademicSite page="service" />;
}
