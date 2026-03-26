// University faculties list
export const FACULTIES = [
  'Faculty of Agriculture Environment And Food Systems',
  'Faculty of Arts And Humanities',
  'Faculty of Business Management Sciences And Economics',
  'Faculty of Computer Engineering Informatics And Communications',
  'Faculty of Education',
  'Faculty of Engineering And The Built Environment',
  'Faculty of Law',
  'Faculty of Medicine And Health Sciences',
  'Faculty of Science',
  'Faculty of Social And Behavioural Sciences',
  'Faculty of Veterinary Science',
] as const;

export type Faculty = typeof FACULTIES[number];
