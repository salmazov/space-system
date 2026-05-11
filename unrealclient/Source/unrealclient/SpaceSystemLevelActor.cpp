#include "SpaceSystemLevelActor.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/Engine.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	constexpr float MapScale = 175.0f;
	constexpr float BasicMeshRadius = 50.0f;
	constexpr float BasicMeshHeight = 100.0f;

	FString PlanetLabel(const FSpaceSystemPlanetView& Planet)
	{
		return FString::Printf(TEXT("%s\n%s"), *Planet.Name, *Planet.Faction);
	}
}

ASpaceSystemLevelActor::ASpaceSystemLevelActor()
{
	PrimaryActorTick.bCanEverTick = false;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
	RootComponent = SceneRoot;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));

	SphereMesh = SphereAsset.Object;
	CubeMesh = CubeAsset.Object;
	CylinderMesh = CylinderAsset.Object;
	BaseMaterial = MaterialAsset.Object;
}

void ASpaceSystemLevelActor::BeginPlay()
{
	Super::BeginPlay();

	BuildPlanetData();
	BuildLighting();
	BuildGrid();
	BuildStars();
	BuildRoutes();
	BuildPlanets();
	BuildPlayerShip();
	BuildStatusBeacon();

	if (GEngine)
	{
		GEngine->AddOnScreenDebugMessage(-1, 8.0f, FColor::Cyan, TEXT("Space System Unreal client: W/A/S/D or screen edges pan, Q/E or mouse wheel zoom"));
	}
}

void ASpaceSystemLevelActor::BuildPlanetData()
{
	Planets = {
		{TEXT("earth"), TEXT("Earth"), TEXT("Union"), FVector2D(-10.0f, 0.0f), FLinearColor(0.18f, 0.55f, 0.92f), 1.25f},
		{TEXT("luna"), TEXT("Luna"), TEXT("Union"), FVector2D(-8.7f, 0.9f), FLinearColor(0.72f, 0.77f, 0.82f), 0.55f},
		{TEXT("mars"), TEXT("Mars"), TEXT("Guild"), FVector2D(2.5f, -5.2f), FLinearColor(0.86f, 0.31f, 0.2f), 1.25f},
		{TEXT("jupiter"), TEXT("Jupiter"), TEXT("League"), FVector2D(13.2f, -1.4f), FLinearColor(0.82f, 0.52f, 0.26f), 1.25f},
		{TEXT("saturn"), TEXT("Saturn"), TEXT("Compact"), FVector2D(26.0f, 5.4f), FLinearColor(0.88f, 0.72f, 0.38f), 1.25f},
		{TEXT("uranus"), TEXT("Uranus Fuel Mine"), TEXT("Frontier"), FVector2D(39.0f, -6.2f), FLinearColor(0.3f, 0.82f, 0.78f), 0.9f}
	};
}

void ASpaceSystemLevelActor::BuildLighting()
{
	UDirectionalLightComponent* KeyLight = NewObject<UDirectionalLightComponent>(this, TEXT("KeyLight"));
	KeyLight->SetupAttachment(SceneRoot);
	KeyLight->SetRelativeRotation(FRotator(-58.0f, -32.0f, 0.0f));
	KeyLight->SetIntensity(3.2f);
	KeyLight->RegisterComponent();

	USkyLightComponent* SkyLight = NewObject<USkyLightComponent>(this, TEXT("SoftSpaceLight"));
	SkyLight->SetupAttachment(SceneRoot);
	SkyLight->SetIntensity(0.45f);
	SkyLight->RegisterComponent();
}

void ASpaceSystemLevelActor::BuildGrid()
{
	AddMesh(TEXT("SpaceFloor"), CubeMesh, FVector(2500.0f, -150.0f, -12.0f), FVector(92.0f, 34.0f, 0.05f), FLinearColor(0.015f, 0.02f, 0.035f));

	for (int32 Index = -18; Index <= 52; Index += 2)
	{
		const float X = Index * MapScale;
		AddCylinderLine(*FString::Printf(TEXT("GridX_%d"), Index), FVector(X, -1750.0f, 4.0f), FVector(X, 1500.0f, 4.0f), 3.0f, FLinearColor(0.05f, 0.09f, 0.13f));
	}

	for (int32 Index = -12; Index <= 10; Index += 2)
	{
		const float Y = Index * MapScale;
		AddCylinderLine(*FString::Printf(TEXT("GridY_%d"), Index), FVector(-2200.0f, Y, 4.0f), FVector(7600.0f, Y, 4.0f), 3.0f, FLinearColor(0.05f, 0.09f, 0.13f));
	}

	AddLabel(TEXT("GridCaption"), TEXT("Known trade space"), FVector(-1750.0f, -1450.0f, 120.0f), 54.0f, FColor(145, 178, 196));
}

void ASpaceSystemLevelActor::BuildStars()
{
	FRandomStream Stream(3016);
	for (int32 Index = 0; Index < 90; ++Index)
	{
		const FVector Location(
			Stream.FRandRange(-2800.0f, 8400.0f),
			Stream.FRandRange(-2200.0f, 2100.0f),
			Stream.FRandRange(450.0f, 1900.0f));
		const float StarScale = Stream.FRandRange(0.018f, 0.052f);
		AddMesh(*FString::Printf(TEXT("Star_%02d"), Index), SphereMesh, Location, FVector(StarScale), FLinearColor(0.62f, 0.78f, 0.95f));
	}
}

void ASpaceSystemLevelActor::BuildRoutes()
{
	for (int32 Index = 1; Index < Planets.Num(); ++Index)
	{
		AddCylinderLine(
			*FString::Printf(TEXT("TradeRoute_%d"), Index),
			ToWorldPosition(Planets[Index - 1].MapPosition, 24.0f),
			ToWorldPosition(Planets[Index].MapPosition, 24.0f),
			9.0f,
			FLinearColor(0.08f, 0.2f, 0.3f));
	}
}

void ASpaceSystemLevelActor::BuildPlanets()
{
	for (const FSpaceSystemPlanetView& Planet : Planets)
	{
		const float Radius = Planet.Scale * 82.0f;
		AddMesh(*FString::Printf(TEXT("Planet_%s"), *Planet.Id), SphereMesh, ToWorldPosition(Planet.MapPosition, Radius), FVector(Radius / BasicMeshRadius), Planet.Color);
		AddMesh(*FString::Printf(TEXT("Explored_%s"), *Planet.Id), CylinderMesh, ToWorldPosition(Planet.MapPosition, 2.0f), FVector((Radius * 3.6f) / BasicMeshRadius, (Radius * 3.6f) / BasicMeshRadius, 0.018f), FLinearColor(0.03f, 0.12f, 0.16f));
		AddLabel(*FString::Printf(TEXT("Label_%s"), *Planet.Id), PlanetLabel(Planet), ToWorldPosition(Planet.MapPosition, Radius + 175.0f), 58.0f, FColor::White);

		if (Planet.Id == TEXT("saturn"))
		{
			AddMesh(TEXT("SaturnRing"), CylinderMesh, ToWorldPosition(Planet.MapPosition, Radius + 2.0f), FVector((Radius * 2.2f) / BasicMeshRadius, (Radius * 2.2f) / BasicMeshRadius, 0.025f), FLinearColor(0.72f, 0.58f, 0.28f));
		}
	}
}

void ASpaceSystemLevelActor::BuildPlayerShip()
{
	const FVector Earth = ToWorldPosition(FVector2D(-10.0f, 0.0f), 150.0f);
	const FVector Mars = ToWorldPosition(FVector2D(2.5f, -5.2f), 150.0f);
	const FVector ShipLocation = Earth + FVector(95.0f, -128.0f, 115.0f);

	AddCylinderLine(TEXT("ActiveRoute"), ShipLocation, Mars + FVector(0.0f, 0.0f, 85.0f), 12.0f, FLinearColor(1.0f, 0.12f, 0.1f));
	AddMesh(TEXT("OwnedShip"), CubeMesh, ShipLocation, FVector(0.42f, 0.28f, 0.18f), FLinearColor(1.0f, 0.12f, 0.1f));
	AddLabel(TEXT("OwnedShipLabel"), TEXT("Surveyor-01\nSmall trade ship\nFuel 36/60"), ShipLocation + FVector(0.0f, 0.0f, 155.0f), 48.0f, FColor(255, 204, 204));
}

void ASpaceSystemLevelActor::BuildStatusBeacon()
{
	AddLabel(
		TEXT("StatusBeacon"),
		TEXT("Space System\nAuthoritative server map preview\nPlanets, routes, explored space, owned ship"),
		FVector(-1550.0f, -1200.0f, 360.0f),
		52.0f,
		FColor(178, 226, 255));
}

FVector ASpaceSystemLevelActor::ToWorldPosition(const FVector2D& MapPosition, float Height) const
{
	return FVector(MapPosition.X * MapScale, MapPosition.Y * MapScale, Height);
}

UMaterialInstanceDynamic* ASpaceSystemLevelActor::CreateColorMaterial(const FLinearColor& Color, FName Name)
{
	UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(BaseMaterial, this, Name);
	if (Material)
	{
		Material->SetVectorParameterValue(TEXT("Color"), Color);
	}
	return Material;
}

UStaticMeshComponent* ASpaceSystemLevelActor::AddMesh(FName Name, UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color)
{
	UStaticMeshComponent* Component = NewObject<UStaticMeshComponent>(this, Name);
	Component->SetupAttachment(SceneRoot);
	Component->SetStaticMesh(Mesh);
	Component->SetWorldLocation(Location);
	Component->SetWorldScale3D(Scale);
	Component->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Component->SetMaterial(0, CreateColorMaterial(Color, FName(*FString::Printf(TEXT("%s_Material"), *Name.ToString()))));
	Component->RegisterComponent();
	return Component;
}

UTextRenderComponent* ASpaceSystemLevelActor::AddLabel(FName Name, const FString& Text, const FVector& Location, float Size, const FColor& Color)
{
	UTextRenderComponent* Label = NewObject<UTextRenderComponent>(this, Name);
	Label->SetupAttachment(SceneRoot);
	Label->SetWorldLocation(Location);
	Label->SetWorldRotation(FRotator(62.0f, 0.0f, 0.0f));
	Label->SetText(FText::FromString(Text));
	Label->SetTextRenderColor(Color);
	Label->SetHorizontalAlignment(EHTA_Center);
	Label->SetWorldSize(Size);
	Label->RegisterComponent();
	return Label;
}

void ASpaceSystemLevelActor::AddCylinderLine(FName Name, const FVector& Start, const FVector& End, float Radius, const FLinearColor& Color)
{
	const FVector Delta = End - Start;
	const float Length = Delta.Size();
	if (Length <= KINDA_SMALL_NUMBER)
	{
		return;
	}

	UStaticMeshComponent* Line = AddMesh(Name, CylinderMesh, Start + Delta * 0.5f, FVector(Radius / BasicMeshRadius, Radius / BasicMeshRadius, Length / BasicMeshHeight), Color);
	Line->SetWorldRotation(FRotationMatrix::MakeFromZ(Delta).Rotator());
}