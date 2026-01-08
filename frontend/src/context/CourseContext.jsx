import { createContext, useState, useContext } from "react";

const CourseContext = createContext();

export function CourseProvider({ children }) {
  const [course, setCourse] = useState("IFIC"); // Default Course

  return (
    <CourseContext.Provider value={{ course, setCourse }}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  return useContext(CourseContext);
}