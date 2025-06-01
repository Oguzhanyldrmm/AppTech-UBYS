export interface User {
  id: string;
  name: string;
  studentId: string;
  department: string;
  mail: string;
  tel_no: string;
  password: string; // In production, this should be hashed
}

export const mockUsers: User[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "Ahmet Yılmaz",
    studentId: "2021001234",
    department: "Computer Engineering",
    mail: "ahmet.yilmaz@university.edu.tr",
    tel_no: "+905551234567",
    password: "AhmetPass123!"
  },
  {
    id: "b2c3d4e5-f6g7-8901-bcde-f23456789012",
    name: "Elif Demir",
    studentId: "2020005678",
    department: "Electrical Engineering",
    mail: "elif.demir@university.edu.tr",
    tel_no: "+905559876543",
    password: "ElifSecure456!"
  },
  {
    id: "c3d4e5f6-g7h8-9012-cdef-345678901234",
    name: "Mehmet Kaya",
    studentId: "2019009876",
    department: "Mechanical Engineering",
    mail: "mehmet.kaya@university.edu.tr",
    tel_no: "+905555551234",
    password: "MehmetKey789!"
  },
  {
    id: "d4e5f6g7-h8i9-0123-defg-456789012345",
    name: "Zeynep Özkan",
    studentId: "2022003456",
    department: "Industrial Engineering",
    mail: "zeynep.ozkan@university.edu.tr",
    tel_no: "+905557778899",
    password: "ZeynepPass321!"
  },
  {
    id: "e5f6g7h8-i9j0-1234-efgh-567890123456",
    name: "Can Şahin",
    studentId: "2021007890",
    department: "Software Engineering",
    mail: "can.sahin@university.edu.tr",
    tel_no: "+905553334455",
    password: "CanStrong654!"
  }
];

