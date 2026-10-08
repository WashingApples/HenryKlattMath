import { AcademicSite, pageInfo } from "../site";

export const metadata = { title: pageInfo.research.title, description: pageInfo.research.description };

export default function Page() {
  return <AcademicSite page="research" />;
}
