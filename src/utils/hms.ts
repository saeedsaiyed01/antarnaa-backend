// utils/hms.ts
export const getOrCreateRoomForDoctor = async (doctor: any) => {
  try {
    if (doctor.roomId) {
      console.log(
        `Using existing room ID: ${doctor.roomId} for doctor: ${doctor.name}`
      );
      return doctor.roomId;
    }

    console.log(`Creating new room for doctor: ${doctor.name}`);

    const res = await fetch("https://api.100ms.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HMS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `room-${doctor._id}`,
        description: `Room for Dr. ${doctor.name}`,
        template_id: process.env.HMS_TEMPLATE_ID,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!res.ok) {
      console.error(`HMS API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    console.log(`Room created successfully with ID: ${data.id}`);

    doctor.roomId = data.id;
    await doctor.save();
    return data.id || "";
  } catch (err) {
    console.error("Error creating HMS room:", err);
    if (err instanceof Error) {
      console.error("Error details:", {
        name: err.name,
        message: err.message,
      });
    }
    return null;
  }
};

export const generateJoinLinks = async (
  roomId: string,
  doctorName: string,
  patientName: string
) => {
  try {
    console.log(
      `Generating join links for room: ${roomId}, doctor: ${doctorName}, patient: ${patientName}`
    );
    console.log(process.env.HMS_TOKEN);

    const baseURL = `https://api.100ms.live/v2/room-codes/room/${roomId}`;

    const generateLink = async (
      userName: string,
      role: string
    ): Promise<string | null> => {
      try {
        console.log(`Generating link for user: ${userName}, role: ${role}`);

        const res = await fetch(baseURL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HMS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: role, // Use the actual role parameter
            user_id: userName,
          }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!res.ok) {
          console.error(
            `HMS API error for ${userName}: ${res.status} ${res.statusText}`
          );
          return null;
        }

        const data = await res.json();
        console.log(`Link generation response for ${userName}:`, data);

        if (data.data && Array.isArray(data.data)) {
          for (let i = 0; i < data.data.length; i++) {
            if (data.data[i].role === role) {
              const link = `https://antarnaa-videoconf-1243.app.100ms.live/meeting/${data.data[i].code}`;
              console.log(`Generated link for ${userName} (${role}): ${link}`);
              return link;
            }
          }
        }

        console.warn(
          `No matching role found for ${userName} with role ${role}`
        );
        return null;
      } catch (err) {
        console.error(`Error generating link for ${userName}:`, err);
        return null;
      }
    };

    const doctorLink = await generateLink(doctorName, "doctor");
    const patientLink = await generateLink(patientName, "guest");

    const result = {
      doctor: doctorLink || "",
      user: patientLink || "",
    };

    console.log("Final generated links:", result);
    return result;
  } catch (err) {
    console.error("Error in generateJoinLinks:", err);
    return {
      doctor: "",
      user: "",
    };
  }
};
