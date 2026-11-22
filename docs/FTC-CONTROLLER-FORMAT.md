# FTC Robot Controller project format

Use the official FIRST Tech Challenge Robot Controller Android Studio project. Do not create a replacement Android project from a standalone Java file.

The relevant project layout is:

```text
FtcRobotController/
├── FtcRobotController/
│   └── src/main/                 Robot Controller Android app
├── TeamCode/
│   ├── build.gradle              TeamCode module configuration
│   └── src/main/java/
│       └── org/firstinspires/ftc/teamcode/
│           └── YourOpMode.java
├── build.gradle
├── gradle.properties
└── settings.gradle
```

Each OpMode Java file begins with the package declaration `org.firstinspires.ftc.teamcode`. The `@TeleOp` annotation registers a driver-controlled program; `@Autonomous` registers an autonomous program. A `LinearOpMode` implements `runOpMode()`, performs hardware mapping before start, calls `waitForStart()`, and checks `opModeIsActive()` during its active work.

Official references:

- FTC documentation: https://ftc-docs.firstinspires.org/en/latest/
- Official Robot Controller SDK: https://github.com/FIRST-Tech-Challenge/FtcRobotController
- SDK overview: https://ftc-docs.firstinspires.org/en/latest/ftc_sdk/overview/index.html

The Java files in this project are examples, not plug-and-play robot configurations. Match all hardware names and mechanical settings to the team's Robot Configuration and robot design. Test with the robot safely supported and at low power before normal operation.
