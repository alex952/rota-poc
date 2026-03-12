# Doctor Rota Assigment APP

## Functional Requirements
The Doctor Rota Assignment application is an application for assination of on-call services by the doctors. Below are the requirements for the assignment of on-call service:

* There are two types of on-call services:
 - Atencion Continuada
 - Atencion Primaria

* All doctors in the pool for rota need to do at least
 - 135 hours per year of Atencion Continuada rota
 - 425 hours per year of Atencion Primaria rota

* Rota schedules are calculated in January for the whole year

* On-call hours are:
 - Mon-Fri: 15:00 -> 8:00+1 : 17 hours
 - Saturdays: 15:00 -> 9:00+1 : 18 hours
 - Sundays and holidays: 9:00 -> 8:00+1 : 23 hours

* The final rota schedule need to fulfill their minimum on-call hours and be as equitative as possible among peers: same or close number of each day of on-call and number of hours

## Technical Requirements
This will be structured in a mono repo with two distinct pieces:
 * Assignment service
 * Rota schedule UI

This is a PoC, so details like login features, or security specific concerns can be bypassed.

### Assignment microservice
The backend service will calculate the assignments based on a pool of doctors that are passed into the API method, and the data will look as follows (but will be enhanced in the future with data that will be required to implement certain constraints)

```json
{
    "year": 2026,
    "pool": 
    [{
        "id": "1234",
        "name": "Example 1",
        "department": "Example department"
    },{
        "id": "1234",
        "name": "Example 1",
        "department": "Example department"
    }]
}

```

and the service will return a JSON-encoded calendar with assignments for each day of the year based on the above constraints.

There wil be another endpoint to just query a rota schedule for a certain year.

The service will query a website tor retrieve the holidays for the city of the hospital (all in Spain) and include whether the date is a Saturda or a Sunday/Holiday.

The service will store the calculated rota for fast future access which will make possible the filtering of the rota schedule by person, as well as the replacement of that person with another doctor.

Tech stack is Python with FastAPI/Pydantic and SQLAlchemy with PostgrSQL db engine.

### Schedule UI
Simple UI service to render the calendar view of the rota. The UI will display a two-column layout with the left column showing the doctor pool in a card-style component that can be drag-and-dropped into the right column that will display a calendar with the days of the month and the assignments calculated by the backend service. A selector of the year (defaulting to current year) will be displayed somewhere in the app.

The left-hand side will be prepopulated from static data in a configuration file, but the user will be able to add doctors to the rota before generating the rota.

The left hand side of the layout will show a set of buttons on the bottom to add the doctors and generate the rota, and by default it will try to get the rota for that year when the page loads. If there's no rota, the generate rota button will read "Generate Rota", but if there is it will read "Re-generate Rota" and show a confirmation dialog explaining the current rota will be replaced with a new one.

An hidden right-hand side panel will show the stats (also returned by the service) of hours for each doctor, etc.

Tech stack will be AngularJS

## Other details
Ensure all versions for frameworks/languages are latest and include a way to run the code conveniently locally as well as a dockerized environment to test.