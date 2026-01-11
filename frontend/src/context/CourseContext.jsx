import { createContext, useState, useContext } from "react";

const CourseContext = createContext();

export const COURSES = {
  IFIC: {
    id: "IFIC",
    label: "IFIC – Investment Funds in Canada",
  },
  CSC_VOL_1: {
    id: "CSC_VOL_1",
    label: "CSC – Volume 1",
  },
  CSC_VOL_2: {
    id: "CSC_VOL_2",
    label: "CSC – Volume 2",
  },
};

export function CourseProvider({ children }) {
  const [course, setCourse] = useState(COURSES.IFIC.id);

  return (
    <CourseContext.Provider
      value={{
        course,
        setCourse,
        courses: Object.values(COURSES),
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  return useContext(CourseContext);
}
