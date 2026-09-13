export default function getEnvName(name: string):string {
    const value = import.meta.env[name];

    if(value === undefined || value === null) {
        throw new Error(`Invalid variable name`);
    }

    return value;
}