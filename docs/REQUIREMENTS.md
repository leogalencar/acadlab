# AcadLab - Laboratory Scheduling and Management System

1. Overview and Main Project Goal
   The objective is to develop a web system called AcadLab to automate and optimize the control and scheduling of laboratories in educational institutions. The system must solve problems such as scheduling errors, overlaps, and lack of transparency, which currently result from a manual, email-based process at Fatec Dom Amaury Castanho. The platform should centralize reservation information, be intuitive and accessible for different user profiles, and provide real-time updates.

2. Technologies to be Used
   The development must use the following technology stack, as specified in the document and your modifications:

- Programming Language: JavaScript and TypeScript.
- Front-end Framework: ReactJS as the main library , with the Next.js framework for structure, routing, and rendering optimizations.
- UI Framework: ShadCN UI and Tailwind CSS will be used for building a modern and accessible user interface.
- Database: MySQL.
- ORM: Prisma
- Version Control: Git, with the code hosted on the GitHub platform.
- Containerization: Docker Compose will be used exclusively for creating and managing the production environment. Development will be conducted on personal, development-ready machines.
- Architecture: The project will follow the natural architecture of Next.js using the App Router, organized with a feature-based design. Files and logic will be grouped by features (e.g., authentication, scheduling) rather than by type.
- Development Environment (IDE): Visual Studio Code.

3. User Structure and Access Levels

- The system must manage three main types of users, each with specific permissions:

  - Professor:

    - Can authenticate (login/logout) and recover their password.
    - Manage their own account (edit name, email, change password).
    - View laboratories, their details, and availability.
    - Create and delete laboratory reservations for their use.
    - Create, view, edit, and cancel software installation requests.

  - Technician (inherits Professor permissions):

    - Has all the permissions of a Professor.
    - Manage laboratories (register, delete, edit).
    - Register new software in the system and associate it with laboratories.
    - Manage professor accounts (register, delete, edit).
    - View and change the status of software requests made by professors.

  - Administrator (inherits Technician permissions):
    - Has all the permissions of a Technician.
    - Manage technician accounts (register, delete, edit).
    - Manage other administrator accounts (register, delete).
    - Edit system rules (e.g., class schedules, break durations, etc.).

4. Detailed Functional Requirements

- Module 1: Authentication and Account Management

  - Create a login screen with fields for email and password.
  - There should be no self-registration option; new users are registered by coordinators, technicians, or administrators.
  - Implement a "Forgot my password" feature for access recovery.
  - Develop a profile page where the logged-in user can edit their personal information, such as name, email, and password.

- Module 2: Laboratory and Resource Management

  - Create a feature for administrators and technicians to register, edit, and delete laboratories. Each laboratory must have a name, capacity (number of workstations), and a status (active/inactive).
  - Implement a system to register software, with a name, version, and supplier.
  - Allow technicians to associate registered software with laboratories, indicating which programs are installed in each.
  - Develop a screen where users can view all registered laboratories.
  - Implement filters on this screen so that users can search for laboratories by date/time availability and by installed software.

- Module 3: Laboratory Scheduling System

  - Create a scheduling interface where, upon selecting a laboratory, the user sees a calendar and available time slots.
  - Allow professors to select a date and one or more time slots to make a reservation.
  - The system must validate in real-time and prevent the booking of already occupied time slots for the same laboratory.
  - Implement a recurring scheduling feature for technicians and administrators, allowing a reservation to be repeated weekly.
  - Develop an "Agenda" screen where the user can see their upcoming appointments.
  - Create a "Booking History" screen that lists all past and future reservations made by the user. For technicians and administrators, this screen should show the reservations of all users.

- Module 4: Software and Maintenance Requests

  - On the details page of a laboratory, add an option for the professor to "Request Software Installation".
  - This option should open a form for the professor to specify the software name, version, and a justification/description for the request.
  - Technicians and administrators must be able to view and manage pending requests.
  - Implement the functionality for technicians to change the status of a request to "approved," "pending," or "rejected".
  - Create a "Request History" screen so that the professor can track the status of their requests. Technicians and administrators should see the history of all requests.

- Module 5: Notification System
  - Implement an in-app notification system.
  - The system should generate automatic notifications for users about:
    - Confirmation of a completed reservation.
    - Cancellation of a reservation.
    - Approval or rejection of a software request.
  - Add a notifications icon in the navigation bar that displays unread notifications.

5. Non-Functional Requirements

- Usability: The interface must be intuitive, clean, and easily accessible. The user interface will be built using ShadCN UI and Tailwind CSS to ensure a modern, responsive, and accessible design that is compatible with different web browsers.
- Performance: Queries for laboratory availability and scheduling updates must occur in real-time, without noticeable delays for the user. The system should be designed for high availability.
- Security: User authentication must be secure, with passwords stored in an encrypted format. The system must record logs of important operations performed by users.
- Maintainability: The source code will be organized using a feature-based design, making it easier to locate, update, and scale individual features independently. The use of Docker for the production environment will ensure it is consistent and reproducible.
