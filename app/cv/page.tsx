import { AcademicSite, pageInfo } from "../site";

export const metadata = { title: pageInfo.cv.title, description: pageInfo.cv.description };

export default function Page() {
  return <AcademicSite page="cv" />;
}
