import { Field } from "formik";
import CreatableSelect from "react-select/creatable";
import { areaLocations } from "./Airports";
import { selectStyles } from "./SelectStyles";

const areaOptions = Object.keys(areaLocations).map((code) => ({
    value: code,
    label: code
}));

// Convert a stored string value into a react-select option object
const toOption = (val) => (val ? { value: val, label: val } : null);

// Given an area code, return the dropdown options for that area.
// If no area is selected, return all locations across all areas.
const getLocationOptions = (area) => {
    if (area && areaLocations[area]) {
        return areaLocations[area];
    }
    return Object.values(areaLocations).flat();
};

/* =============================================
   TRIP DETAILS FIELDS
   Left-hand column of the reservation form:
   area/location pickers, timing, flight info,
   and the notes/trip-type/account fields.
   Rendered inside a <Formik> tree, so <Field>
   binds to form context automatically — only
   the pieces driven by custom selects need
   values/setFieldValue passed in explicitly.
============================================= */
export default function TripDetailsFields({ values, setFieldValue }) {
    const locationOptions = getLocationOptions(values.Area);

    return (
        <div className="md:col-span-1 flex flex-col gap-3">

            {/* =====================
                AREA (airport code select)
            ===================== */}
            <div>
                <CreatableSelect
                    options={areaOptions}
                    value={values.Area ? { value: values.Area, label: values.Area } : null}
                    onChange={(selected) => {
                        setFieldValue("Area", selected?.value || "");
                    }}
                    isClearable
                    placeholder="Select Area (airport code)"
                    formatCreateLabel={(input) => `Use area: "${input}"`}
                    styles={selectStyles}
                />
            </div>

            {/* =====================
                PU LOCATION
            ===================== */}
            <div>
                <CreatableSelect
                    options={locationOptions}
                    value={toOption(values.PUlocation)}
                    onChange={(selected) =>
                        setFieldValue("PUlocation", selected?.value || "")
                    }
                    isClearable
                    placeholder="PU location — pick from list or type custom address"
                    formatCreateLabel={(input) => `Use address: "${input}"`}
                    noOptionsMessage={() => "Select an Area above to see options, or type a custom address"}
                    styles={selectStyles}
                />
            </div>

            {/* =====================
                DO LOCATION
            ===================== */}
            <div>
                <CreatableSelect
                    options={locationOptions}
                    value={toOption(values.DOlocation)}
                    onChange={(selected) =>
                        setFieldValue("DOlocation", selected?.value || "")
                    }
                    isClearable
                    placeholder="DO location — pick from list or type custom address"
                    formatCreateLabel={(input) => `Use address: "${input}"`}
                    noOptionsMessage={() => "Select an Area above to see options, or type a custom address"}
                    styles={selectStyles}
                />
            </div>

            <Field
                type="date"
                name="PUdate"
                className="border p-2 rounded"
            />

            <Field
                type="time"
                name="PUtime"
                className="border p-2 rounded"
            />

            <Field
                type="text"
                name="FlightNumber"
                className="border p-2 rounded"
                placeholder="Flight Number"
            />

            <Field
                type="text"
                name="PAX"
                className="border p-2 rounded"
                placeholder="PAX#"
            />

            <Field
                as="textarea"
                name="DISPnotes"
                className="border p-2 rounded"
                placeholder="Notes"
            />

            <Field
                as="select"
                name="TripInfo"
                className="border p-2 rounded"
            >
                <option value="">Select type</option>
                <option value="Add On">Add On</option>
                <option value="Manifest">Manifest</option>
            </Field>

            <Field
                as="select"
                name="Account"
                className="border p-2 rounded"
            >
                <option value="">Select account</option>
                <option value="Southwest unscheduled">
                    Southwest unscheduled
                </option>
                <option value="American Airlines unscheduled">
                    American Airlines unscheduled
                </option>
            </Field>

        </div>
    );
}
