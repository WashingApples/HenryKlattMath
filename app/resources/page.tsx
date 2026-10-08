import { AcademicSite, pageInfo } from "../site";

export const metadata = { title: pageInfo.resources.title, description: pageInfo.resources.description };

export default function Page() {
  return <AcademicSite page="resources" />;
}
