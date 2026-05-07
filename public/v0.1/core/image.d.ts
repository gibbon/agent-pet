export interface PetImageResult {
    dataUrl: string;
    width: number;
    height: number;
    reencoded: boolean;
}
export declare function loadPetImageFromFile(file: File): Promise<PetImageResult>;
