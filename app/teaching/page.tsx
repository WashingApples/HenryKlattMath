import { AcademicSite, pageInfo } from "../site";

export const metadata = { title: pageInfo.teaching.title, description: pageInfo.teaching.description };

export default function Page() {
  return <AcademicSite page="teaching" />;
}
